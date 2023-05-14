import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as iottwinmaker from 'aws-cdk-lib/aws-iottwinmaker';
import * as s3 from 'aws-cdk-lib/aws-s3';
// import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
// import * as grafana from 'aws-cdk-lib/aws-grafana'

export class TmMpCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * CfnParameter
     */

    const workspaceId = new cdk.CfnParameter(this, 'TwinmakerWorkspaceId', {
      description: 'IoT TwinMaker Workspace ID',
      type: 'String'
    })

    const mpApplicationKey = new cdk.CfnParameter(this, 'MatterportApplicationKey', {
      description: 'Matterport Application Key',
      type: 'String',
      noEcho: true
    })

    const mpClientId = new cdk.CfnParameter(this, 'MatterportClientId', {
      description: 'Matterport Client ID',
      type: 'String',
      noEcho: true
    })

    const mpClientSecret = new cdk.CfnParameter(this, 'MatterportClientSecret', {
      description: 'Matterport Client ID',
      type: 'String',
      noEcho: true
    })


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
        [`${workspaceId.valueAsString}-AutoPolicy`]: new iam.PolicyDocument({
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

    const workspace = new iottwinmaker.CfnWorkspace(this, 'workspace', {
      workspaceId: workspaceId.valueAsString,
      s3Location: bucket.bucketArn,
      role: role.roleArn,
    })

    new cdk.CfnOutput(this, 'workspace-output', {
      value: workspace.attrArn
    })

    // Sceneは手作りしたほうがいいかもしれない

    // new s3deploy.BucketDeployment(this, 'deploy', {
    //   destinationBucket: bucket,
    //   sources: [s3deploy.Source.data('matterport-scene.json', `{"specVersion":"1.0","version":"1","unit":"meters","nodes":[],"rootNodeIndexes":[],"cameras":[],"rules":{"sampleAlarmIconRule":{"statements":[{"expression":"alarm_status == 'ACTIVE'","target":"iottwinmaker.common.icon:Error"},{"expression":"alarm_status == 'ACKNOWLEDGED'","target":"iottwinmaker.common.icon:Warning"},{"expression":"alarm_status == 'SNOOZE_DISABLED'","target":"iottwinmaker.common.icon:Warning"},{"expression":"alarm_status == 'NORMAL'","target":"iottwinmaker.common.icon:Info"}]},"sampleTimeSeriesIconRule":{"statements":[{"expression":"temperature >= 40","target":"iottwinmaker.common.icon:Error"},{"expression":"temperature >= 20","target":"iottwinmaker.common.icon:Warning"},{"expression":"temperature < 20","target":"iottwinmaker.common.icon:Info"}]},"sampleTimeSeriesColorRule":{"statements":[{"expression":"temperature >= 40","target":"iottwinmaker.common.color:#FF0000"},{"expression":"temperature >= 20","target":"iottwinmaker.common.color:#FFFF00"},{"expression":"temperature < 20","target":"iottwinmaker.common.color:#00FF00"}]}},"properties":{"environmentPreset":"neutral"}}`)],
    //   prune: false
    // })

    // const scene = new iottwinmaker.CfnScene(this, 'scene', {
    //   workspaceId: workspaceId.valueAsString,
    //   sceneId: 'matterport-scene',
    //   contentLocation: bucket.s3UrlForObject('matterport-scene.json')
    // })

    // ---

    const secret = new secretsmanager.Secret(this, 'secrets', {
      secretObjectValue: {
        'application_key': new cdk.SecretValue(mpApplicationKey.valueAsString),
        'client_id': new cdk.SecretValue(mpClientId.valueAsString),
        'client_secret': new cdk.SecretValue(mpClientSecret.valueAsString)
      },
    })
    cdk.Tags.of(secret).add('AWSIoTTwinMaker_Matterport', '')

    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue'
      ],
      resources: [
        secret.secretArn
      ]
    }))

    /**
     * Grafana
     */

    const grafanaRole = new iam.Role(this, 'grafana-role', {
      assumedBy: new iam.ServicePrincipal('grafana.amazonaws.com', {
        conditions: {
          'StringEquals': {
            'aws:SourceAccount': this.account
          },
          'StringLike': {
            'aws:SourceArn': `arn:aws:grafana:${this.region}:${this.account}:/workspaces/*`
          }
        }
      }),
    })

    // const grafanaWorkspace = new grafana.CfnWorkspace(this, 'grafanaworkspace', {
    //   accountAccessType: 'CURRENT_ACCOUNT',
    //   authenticationProviders: ['AWS_SSO'],
    //   permissionType: 'SERVICE_MANAGED',
    //   roleArn: grafanaRole.roleArn,
    // })

    /**
     * ダッシュボードロール
     */

    const dashboardRole = new iam.Role(this, 'dashboardRole', {
      roleName: `${workspaceId.valueAsString}DashboardRole`,
      assumedBy: new iam.ArnPrincipal(grafanaRole.roleArn)
    })
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject'
      ],
      resources: [
        `${bucket.bucketArn}`,
        `${bucket.bucketArn}/*`,
      ]
    }))
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iottwinmaker:Get*',
        'iottwinmaker:List*'
      ],
      resources: [
        `${workspace.attrArn}`,
        `${workspace.attrArn}/*`,
      ]
    }))
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iottwinmaker:ListWorkspaces',
      ],
      resources: ['*']
    }))
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kinesisvideo:GetDataEndpoint',
        'kinesisvideo:GetHLSStreamingSessionURL'
      ],
      resources: ['*']
    }))
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iotsitewise:GetAssetPropertyValue',
        'iotsitewise:GetInterpolatedAssetPropertyValues'
      ],
      resources: ['*']
    }))
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iotsitewise:BatchPutAssetPropertyValue'
      ],
      resources: ['*'],
      conditions: {
        'StringLike': {
          'aws:ResourceTag/EdgeConnectorForKVS': '*TwinmakerWorkspaceId*'
        }
      }
    }))

  }
}
