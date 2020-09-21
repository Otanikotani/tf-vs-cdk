import {Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal} from '@aws-cdk/aws-iam';
import { CfnDBCluster, CfnDBClusterParameterGroup, CfnDBInstance, CfnDBSubnetGroup } from "@aws-cdk/aws-neptune";
import { App, Stack, StackProps } from "@aws-cdk/core";
import { VpcResources } from "./network-stack";
import {AssetCode, Function, Runtime} from "@aws-cdk/aws-lambda";
import {LambdaRestApi} from "@aws-cdk/aws-apigateway";

interface NeptuneStackProps extends StackProps {
    vpcResources: VpcResources
    stage: string
}

export class NeptuneClusterStack extends Stack {

    readonly endpoint: string;
    readonly subnetGroup: CfnDBSubnetGroup;
    readonly neptuneToS3Role: Role;
    readonly lambdaRole: Role;

    constructor(scope: App, id: string, props: NeptuneStackProps) {
        super(scope, id, props);

        const vpcResources = props.vpcResources

        const subnetGroupName = `co-neptune-db-subnet-group-${props.stage}`
        this.subnetGroup = new CfnDBSubnetGroup(this, `co-neptune-db-subnet-group-${props.stage}`, {
            dbSubnetGroupDescription: "vpc subnets for Neptune cluster",
            subnetIds: vpcResources.subnets.map(value => value.subnetId),
            dbSubnetGroupName: subnetGroupName
        })

        const clusterParameterGroup = new CfnDBClusterParameterGroup(this, `co-neptune-db-cluster-parameter-group-${props.stage}`, {
            family: "neptune1",
            parameters: {
                neptune_enforce_ssl: 0
            },
            description: `co-neptune-parameter-group-${props.stage}`
        })

        const s3ReadOnly = ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
        this.neptuneToS3Role = new Role(this, `co-neptune-to-s3-access-role-${props.stage}`, {
            roleName: `co-neptune-to-s3-access-role-${props.stage}`,
            managedPolicies: [s3ReadOnly],
            assumedBy: new ServicePrincipal("rds.amazonaws.com"),
        })

        // const s3VpcEndpoint = new CfnVPCEndpoint(this, `co-neptune-s3-endpoint-${props.stage}`, {
        //     serviceName: 'com.amazonaws.us-east-1.s3',
        //     vpcId: vpcResources.centralVpc.vpcId,
        //     subnetIds: vpcResources.subnets.map(value => value.subnetId)
        // })

        const dbCluster = new CfnDBCluster(this, `co-neptune-db-cluster-${props.stage}`, {
            dbSubnetGroupName: this.subnetGroup.dbSubnetGroupName,
            dbClusterIdentifier: `co-neptune-db-cluster-${props.stage}`,
            dbClusterParameterGroupName: clusterParameterGroup.name,
            iamAuthEnabled: false,
            vpcSecurityGroupIds: [vpcResources.securityGroup.securityGroupId],
        });

        dbCluster.addDependsOn(this.subnetGroup)
        dbCluster.addPropertyOverride("AssociatedRoles", [{RoleArn: this.neptuneToS3Role.roleArn}])

        const dbInstance = new CfnDBInstance(this, `co-neptune-db-instance-${props.stage}`, {
            dbInstanceClass: "db.t3.medium",
            dbClusterIdentifier: dbCluster.dbClusterIdentifier,
        });
        dbInstance.addDependsOn(dbCluster)

        this.endpoint = dbCluster.attrEndpoint;
    }

}
