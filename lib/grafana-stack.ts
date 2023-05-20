import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';

export class GrafanaStack extends cdk.NestedStack {

  public readonly grafanaRoleArn: string

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
    const filesystem = new efs.FileSystem(this, 'filesystem', {
      vpc: vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    /**
     * ECS Cluster
     */
    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc: vpc,
      enableFargateCapacityProviders: true,
    })

    /**
     * ECS Task Definition
     */
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'task')

    const container = taskDefinition.addContainer('container', {
      image: ecs.ContainerImage.fromRegistry('grafana/grafana-oss'),
      user: 'root:root',
      environment: {
        'GF_INSTALL_PLUGINS': 'grafana-iot-twinmaker-app'
      },
      portMappings: [
        {
          containerPort: 3000
        }
      ],
      readonlyRootFilesystem: true,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'grafana' }),
    })

    const volumes = [
      { name: 'data', path: '/var/lib/grafana' },
      { name: 'tmp', path: '/tmp' },
    ]

    volumes.forEach((volume) => {
      taskDefinition.addVolume({
        name: volume.name,
        efsVolumeConfiguration: {
          fileSystemId: filesystem.fileSystemId,
          transitEncryption: 'ENABLED',
        }
      })

      container.addMountPoints({
        containerPath: volume.path,
        sourceVolume: volume.name,
        readOnly: false,
      })
    })

    /**
     * ECS Service
     */
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'service', {
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
      desiredCount: 1,
    })

    service.targetGroup.configureHealthCheck({
      path: '/api/health',
      // port: '3000',
      // healthyThresholdCount: 5,
      unhealthyThresholdCount: 10,
      timeout: cdk.Duration.seconds(10),
      // healthyHttpCodes: '200-399',
    })

    filesystem.connections.allowDefaultPortFrom(service.service)

    /**
     * CloudFront Distribution
     */
    const distribution = new cloudfront.Distribution(this, 'distribution', {
      defaultBehavior: {
        origin: new HttpOrigin(service.loadBalancer.loadBalancerDnsName, {
          httpPort: 80,
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
    })

    this.grafanaRoleArn = taskDefinition.taskRole!.roleArn

    new cdk.CfnOutput(this, 'outputCluster', {
      value: cluster.clusterArn,
      description: 'ECS Cluster ARN'
    })

    new cdk.CfnOutput(this, 'cloudFrontDomain', {
      value: `https://${distribution.domainName}/`,
      description: 'Grafana URL'
    })

  }
}
