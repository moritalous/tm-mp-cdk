# README

* Install pnpm

```shell
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

* Install Node.js

```shell
pnpm env use --global lts
```

* Install CDK

```shell
pnpm add -g aws-cdk
```

* Create Project

```shell
mkdir tm-mp-cdk
cd $_

cdk init app --language typescript
```

* (option)Link AWS credentials

```shell
ln -s $PWD/.aws ~/.aws
```

* Deploy

```shell
TwinmakerWorkspaceId=TwinmakerWorkspaceId
MatterportApplicationKey=MatterportApplicationKey
MatterportClientId=MatterportClientId
MatterportClientSecret=MatterportClientSecret

cdk deploy \
--require-approval never \
--parameters TwinmakerWorkspaceId=${TwinmakerWorkspaceId} \
--parameters MatterportApplicationKey=${MatterportApplicationKey} \
--parameters MatterportClientId=${MatterportClientId} \
--parameters MatterportClientSecret=${MatterportClientSecret}
```
