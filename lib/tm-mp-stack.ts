import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

import { DashboardRoleStack } from './dashboard-role-stack';
import { GrafanaStack } from './grafana-stack';
import { TwinMakerStack } from './twinmaker-stack';

export class RootStack extends cdk.Stack {
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

    /**
     * Secrets Manager
     */
    const secret = new secretsmanager.Secret(this, 'secrets', {
      secretObjectValue: {
        'application_key': new cdk.SecretValue(mpApplicationKey.valueAsString),
        'client_id': new cdk.SecretValue(mpClientId.valueAsString),
        'client_secret': new cdk.SecretValue(mpClientSecret.valueAsString)
      },
    })

    cdk.Tags.of(secret).add('AWSIoTTwinMaker_Matterport', '')

    /**
     * IoT TwinMaker
    */
    const twinmaker = new TwinMakerStack(this, 'twinmaker', {
      workspaceId: workspaceId.valueAsString,
      secretArn: secret.secretArn
    })

    /**
     * Grafana
     */
    const grafana = new GrafanaStack(this, 'grafana')

    /**
     * Dashboard role
     */
    const dashboardRole = new DashboardRoleStack(this, 'dashboardRole', {
      bucketArn: twinmaker.bucketArn,
      grafanaRoleArn: grafana.grafanaRoleArn,
      workspaceArn: twinmaker.workspaceArn,
      workspaceId: workspaceId.valueAsString
    })

  }
}
