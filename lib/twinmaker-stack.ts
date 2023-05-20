import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as iottwinmaker from 'aws-cdk-lib/aws-iottwinmaker';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface StackProps extends cdk.StackProps {
  workspaceId: string,
  secretArn: string
}

export class TwinMakerStack extends cdk.NestedStack {

  public readonly bucketArn: string
  public readonly workspaceArn: string

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'bucket', {
      cors: [{
        allowedHeaders: [
          "*"
        ],
        allowedMethods: [
          s3.HttpMethods.GET,
          s3.HttpMethods.PUT,
          s3.HttpMethods.POST,
          s3.HttpMethods.DELETE,
          s3.HttpMethods.HEAD
        ],
        allowedOrigins: [
          '*'
        ],
        exposedHeaders: [
          'ETag'
        ]
      }]
    })

    const role = new iam.Role(this, 'role', {
      assumedBy: new iam.ServicePrincipal('iottwinmaker.amazonaws.com'),
      inlinePolicies: {
        [`${props.workspaceId}-AutoPolicy`]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetBucket',
                's3:GetObject',
                's3:ListBucket',
                's3:PutObject',
                's3:ListObjects',
                's3:ListObjectsV2',
                's3:GetBucketLocation'
              ],
              resources: [
                `${bucket.bucketArn}`,
                `${bucket.bucketArn}/*`
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:DeleteObject'
              ],
              resources: [
                `${bucket.bucketArn}/DO_NOT_DELETE_WORKSPACE_*`
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lambda:InvokeFunction'
              ],
              resources: [
                'arn:aws:lambda:*:*:function:iottwinmaker-*'
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kinesisvideo:DescribeStream'
              ],
              resources: [
                '*'
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'iotsitewise:DescribeAssetModel',
                'iotsitewise:ListAssetModels',
                'iotsitewise:DescribeAsset',
                'iotsitewise:ListAssets',
                'iotsitewise:DescribeAssetProperty',
                'iotsitewise:GetAssetPropertyValue',
                'iotsitewise:GetAssetPropertyValueHistory'
              ],
              resources: [
                '*'
              ]
            })
          ]
        })
      }
    })

    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue'
      ],
      resources: [
        props.secretArn
      ]
    }))

    const workspace = new iottwinmaker.CfnWorkspace(this, 'workspace', {
      workspaceId: props.workspaceId,
      s3Location: bucket.bucketArn,
      role: role.roleArn,
    })

    new cdk.CfnOutput(this, 'workspace-output', {
      value: workspace.attrArn
    })

    // // Sceneは手作りしたほうがいいかもしれない

    // // new s3deploy.BucketDeployment(this, 'deploy', {
    // //   destinationBucket: bucket,
    // //   sources: [s3deploy.Source.data('matterport-scene.json', `{"specVersion":"1.0","version":"1","unit":"meters","nodes":[],"rootNodeIndexes":[],"cameras":[],"rules":{"sampleAlarmIconRule":{"statements":[{"expression":"alarm_status == 'ACTIVE'","target":"iottwinmaker.common.icon:Error"},{"expression":"alarm_status == 'ACKNOWLEDGED'","target":"iottwinmaker.common.icon:Warning"},{"expression":"alarm_status == 'SNOOZE_DISABLED'","target":"iottwinmaker.common.icon:Warning"},{"expression":"alarm_status == 'NORMAL'","target":"iottwinmaker.common.icon:Info"}]},"sampleTimeSeriesIconRule":{"statements":[{"expression":"temperature >= 40","target":"iottwinmaker.common.icon:Error"},{"expression":"temperature >= 20","target":"iottwinmaker.common.icon:Warning"},{"expression":"temperature < 20","target":"iottwinmaker.common.icon:Info"}]},"sampleTimeSeriesColorRule":{"statements":[{"expression":"temperature >= 40","target":"iottwinmaker.common.color:#FF0000"},{"expression":"temperature >= 20","target":"iottwinmaker.common.color:#FFFF00"},{"expression":"temperature < 20","target":"iottwinmaker.common.color:#00FF00"}]}},"properties":{"environmentPreset":"neutral"}}`)],
    // //   prune: false
    // // })

    // // const scene = new iottwinmaker.CfnScene(this, 'scene', {
    // //   workspaceId: workspaceId.valueAsString,
    // //   sceneId: 'matterport-scene',
    // //   contentLocation: bucket.s3UrlForObject('matterport-scene.json')
    // // })

    this.bucketArn = bucket.bucketArn
    this.workspaceArn = workspace.attrArn

  }
}
