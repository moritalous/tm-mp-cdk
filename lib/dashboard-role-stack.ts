import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as iam from 'aws-cdk-lib/aws-iam';

export interface StackProps extends cdk.StackProps {
  workspaceId: string,
  workspaceArn: string,
  grafanaRoleArn: string,
  bucketArn: string
}

export class DashboardRoleStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const grafanaRole = iam.Role.fromRoleArn(this, 'grafanaRole', props.grafanaRoleArn)

    const dashboardRole = new iam.Role(this, 'dashboardRole', {
      roleName: `${props!.workspaceId}DashboardRole`,
      assumedBy: new iam.PrincipalWithConditions(
        new iam.AccountRootPrincipal(),
        {
          'StringLike': {
            'aws:PrincipalArn': `*/${grafanaRole.roleName}/*`
          }
        }
      )
    })
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject'
      ],
      resources: [
        `${props.bucketArn}`,
        `${props.bucketArn}/*`,
      ]
    }))
    dashboardRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iottwinmaker:Get*',
        'iottwinmaker:List*'
      ],
      resources: [
        `${props.workspaceArn}`,
        `${props.workspaceArn}/*`,
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

    grafanaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [dashboardRole.roleArn]
      })
    )


    new cdk.CfnOutput(this, 'DashboardRole', {
      value: dashboardRole.roleArn,
      description: 'Dashborad Role(Assume Role ARN)'
    })

  }
}
