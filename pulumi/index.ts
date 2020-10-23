import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import {Role, RolePolicyAttachment} from "@pulumi/aws/iam";

const centralVpc = awsx.ec2.Vpc.fromExistingIds('co-NetworkStack-dev/co-vpc-dev', {vpcId: 'vpc-0f897912158b8c58e'})

const securityGroup = new awsx.ec2.SecurityGroup('pulumi-neptune-security-group', {
    description: 'pulumi-neptune-security-group',
    vpc: centralVpc,
})

securityGroup.createIngressRule('all tcp', {
    location: {
        sourceSecurityGroupId: securityGroup.id
    },
    ports: new awsx.ec2.AllTcpPorts(),
    description: 'all tcp'
})

securityGroup.createIngressRule('gremlin', {
    location: new awsx.ec2.AnyIPv4Location(),
    ports: new awsx.ec2.TcpPorts(8182),
    description: 'gremlin'
})

securityGroup.createIngressRule('gremlin', {
    location: new awsx.ec2.AnyIPv6Location(),
    ports: new awsx.ec2.TcpPorts(8182),
    description: 'gremlin'
})

const subnets = [
    aws.ec2.Subnet.get('subnet-0esrdtfyguhjkl', 'subnet-0esrdtfyguhjkl', {availabilityZone: 'c', vpcId: centralVpc.id}),
    aws.ec2.Subnet.get('subnet-0esrdtfyguhjkl', 'subnet-0esrdtfyguhjkl', {availabilityZone: 'd', vpcId: centralVpc.id}),
]

const subnetGroup = new aws.rds.SubnetGroup('pulumi-neptune-subnet-group', {
    name: 'pulumi-neptune-subnet-group',
    subnetIds: subnets.map(value => value.id)
})

const clusterParameterGroup = new aws.rds.ClusterParameterGroup('pulumi-neptune-cluster-paremeter-group', {
        family: "neptune1",
        parameters: [
            {name: "neptune_enforce_ssl", value: "0"}
        ],
    }
)

const s3ReadOnly = aws.iam.ManagedPolicies.AmazonS3ReadOnlyAccess

const neptuneToS3Role = new aws.iam.Role('pulumi-neptune-to-s3-role', {
    name: 'pulumi-neptune-to-s3-role',
    assumeRolePolicy: {
        Version: "2012-10-17",
        Statement: [{
            Action: "sts:AssumeRole",
            Principal: {
                Service: "rds.amazonaws.com"
            },
            Effect: "Allow",
            Sid: "",
        }]
    },
})

new RolePolicyAttachment('pulumi-neptune-to-s3-role-attachment', {
    role: neptuneToS3Role,
    policyArn: s3ReadOnly
})

const dbCluster = new aws.neptune.Cluster('pulumi-neptune-db-cluster', {
    neptuneSubnetGroupName: subnetGroup.name,
    clusterIdentifier: 'pulumi-neptune-db-cluster',
    neptuneClusterParameterGroupName: clusterParameterGroup.name,
    iamDatabaseAuthenticationEnabled: true,
    vpcSecurityGroupIds: [securityGroup.id],
    iamRoles: [neptuneToS3Role.arn]
})

const dbInstance = new aws.neptune.ClusterInstance('pulumi-neptune-db-instance', {
    instanceClass: 'db.t3.medium',
    clusterIdentifier: dbCluster.clusterIdentifier
})

const bucket = new aws.s3.Bucket('pulumi-resource-ingestion-bucket', {
    bucket: 'pulumi-resource-ingestion-bucket',
    forceDestroy: true,
    acl: "private"
})

const glueDb = new aws.glue.CatalogDatabase('pulumi-resource-ingestion', {
    name: 'pulumi-resource-ingestion'
})

const glueServiceRole = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"

const crawlerRole = new Role('pulumi-crawler-role', {
    name: 'pulumi-crawler-role',
    assumeRolePolicy: {
        Version: "2012-10-17",
        Statement: [{
            Action: "sts:AssumeRole",
            Principal: {
                Service: "glue.amazonaws.com"
            },
            Effect: "Allow",
            Sid: "",
        }]
    }
})

const readS3Policy = new aws.iam.RolePolicy('pulumi-read-s3-policy', {
    role: crawlerRole,
    policy: {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Action: ["s3:GetObject", "s3:PutObject"],
                Resource: [bucket.arn + "*"]
            }
        ]
    }
})

const crawler = new aws.glue.Crawler('pulumi-crawler', {
    role: crawlerRole.arn,
    name: 'pulumi-crawler',
    databaseName: glueDb.name,
    s3Targets: [
        {path: `s3://${bucket.bucket}`}
    ]
})

const workflow = new aws.glue.Workflow('pulumi-workflow', {
    name: 'pulumi-workflow'
})




