import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam'

import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'

export class GrafanaFargateStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * VPC
     */

    const vpc = new ec2.Vpc(this, 'vpc', {
      natGateways: 0
    })

    /**
     * EFS
     */

    const volume = new efs.FileSystem(this, 'volume', {
      vpc: vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    /**
     * ECS
     */

    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc: vpc,
      enableFargateCapacityProviders: true,
    })

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'taskDefinition')

    const container = taskDefinition.addContainer('container', {
      image: ecs.ContainerImage.fromRegistry('grafana/grafana-oss'),
      environment: {
        'GF_INSTALL_PLUGINS': 'grafana-iot-twinmaker-app'
      },
      portMappings: [
        {
          containerPort: 3000
        }
      ],
      user: 'root:root',
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'grafana-oss' }),
    })

    const voluemName = 'grafana'

    taskDefinition.addVolume({
      name: voluemName,
      efsVolumeConfiguration: {
        fileSystemId: volume.fileSystemId,
        transitEncryption: 'ENABLED',
      }
    })
    container.addMountPoints({
      containerPath: '/var/lib/grafana',
      sourceVolume: voluemName,
      readOnly: false,
    })
    /**
     * 
     */

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'albFargate', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      cpu: 512,
      memoryLimitMiB: 1024,
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1
        }
      ],
      assignPublicIp: true,
    })

    service.targetGroup.configureHealthCheck({
      healthyHttpCodes: "200-399"
    })

    volume.connections.allowDefaultPortFrom(service.service)


  }
}  