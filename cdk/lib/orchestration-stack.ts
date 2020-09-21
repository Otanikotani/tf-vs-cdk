import * as glue from "@aws-cdk/aws-glue";
import {CfnConnection} from "@aws-cdk/aws-glue";
import {App, Stack, StackProps} from '@aws-cdk/core';
import {BlockPublicAccess} from '@aws-cdk/aws-s3';
import * as s3deploy from '@aws-cdk/aws-s3-deployment';
import {
    ArnPrincipal,
    CompositePrincipal,
    Effect,
    ManagedPolicy,
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal
} from '@aws-cdk/aws-iam';
import {AutoDeleteBucket} from '@mobileposse/auto-delete-bucket'
import {VpcResources} from "./network-stack";
import {NeptuneClusterStack} from "./neptune-cluster-stack";
import ConnectionInputProperty = CfnConnection.ConnectionInputProperty;

interface OrchestrationStackProps extends StackProps {
    vpcResources: VpcResources,
    stage: string,
    neptuneStack: NeptuneClusterStack
}

export class OrchestrationStack extends Stack {

    constructor(scope: App, id: string, props: OrchestrationStackProps) {
        super(scope, id, props)

        const bucket = new AutoDeleteBucket(this, `co-resource-ingestion-bucket-${props.stage}`, {
            bucketName: `co-resource-ingestion-bucket-${props.stage}`,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            publicReadAccess: false,
        })

        const glueDb = new glue.Database(this, `co-resource-ingestion-${props.stage}`, {
            databaseName: `co-resources-${props.stage}`
        })

        const glueServiceRole = ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')

        const crawlerRole = new Role(this, `co-crawler-role-${props.stage}`, {
            roleName: `glue-crawler-role-${props.stage}`,
            assumedBy: new ServicePrincipal("glue.amazonaws.com"),
            managedPolicies: [glueServiceRole],
            inlinePolicies: {
                "co-crawler-read-s3": new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['s3:GetObject', 's3:PutObject'],
                        resources: [bucket.bucketArn + "*"]
                    })
                    ]
                })
            }
        })

        const crawler = new glue.CfnCrawler(this, `co-crawler-${props.stage}`, {
            role: crawlerRole.roleArn,
            databaseName: glueDb.databaseName,
            name: `co-crawler-${props.stage}`,
            targets: {
                s3Targets: [{path: `s3://${bucket.bucketName}`}]
            }
        })

        const jobBucket = new AutoDeleteBucket(this, `co-glue-job-bucket-${props.stage}`, {
            bucketName: `co-glue-job-bucket-${props.stage}`,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            publicReadAccess: false,
        })

        new s3deploy.BucketDeployment(this, `co-glue-job-deployment-${props.stage}`, {
            sources: [s3deploy.Source.asset('./jobs')],
            destinationBucket: jobBucket,
        })

        const inspectRole = new Role(this, `co-glue-inspect-role-${props.stage}`, {
            roleName: `co-glue-inspect-role-${props.stage}`,
            assumedBy: new ServicePrincipal("glue.amazonaws.com"),
            managedPolicies: [glueServiceRole],
            inlinePolicies: {
                "glue-inspect-assume-policy": new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['sts:AssumeRole'],
                        resources: ['arn:aws:iam::*:role/co-third-party-inspection-role']
                    })
                    ]
                }),
                "glue-inspect-s3-policy": new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['s3:*'],
                        resources: [jobBucket.bucketArn + "*", bucket.bucketArn + "*"]
                    })]
                })
            }
        })

        const transformRole = new Role(this, `co-glue-transform-role-${props.stage}`, {
            roleName: `co-glue-transform-role-${props.stage}`,
            assumedBy: new ServicePrincipal("glue.amazonaws.com"),
            managedPolicies: [glueServiceRole],
            inlinePolicies: {
                "glue-transform-s3-policy": new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['s3:*'],
                        resources: [jobBucket.bucketArn + "*", bucket.bucketArn + "*"]
                    })
                    ]
                }),
                "allow-assume-role": new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['sts:AssumeRole'],
                        resources: ["*"]
                    })]
                })
            }
        })

        const bulkLoadRole = new Role(this, `co-glue-bulk-load-role-${props.stage}`, {
            roleName: `co-glue-bulk-load-role-${props.stage}`,
            assumedBy: new ServicePrincipal("glue.amazonaws.com"),
            managedPolicies: [glueServiceRole],
            inlinePolicies: {
                "glue-bulk-load-s3-policy": new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['s3:*'],
                        resources: [jobBucket.bucketArn + "*", bucket.bucketArn + "*"]
                    })
                    ]
                }),
                "allow-assume-role": new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['sts:AssumeRole'],
                        resources: ["*"]
                    })]
                })
            }
        })


        const neptuneAccessRole = new Role(this, `co-neptune-access-role-${props.stage}`, {
            roleName: `co-neptune-access-role-${props.stage}`,
            assumedBy: new CompositePrincipal(
                new ServicePrincipal("glue.amazonaws.com"),
                new ServicePrincipal("lambda.amazonaws.com"),
                new ArnPrincipal(bulkLoadRole.roleArn),
                new ArnPrincipal(props.neptuneStack.lambdaRole.roleArn)),
            inlinePolicies: {
                "neptune-access-policy": new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['neptune-db:connect'],
                        resources: ['arn:aws:neptune-db:*']
                    })]
                })
            },
        })

        const neptuneConnection = new CfnConnection(this, `co-neptune-connection-${props.stage}`, {
            catalogId: props.env?.account!!,
            connectionInput: {
                name: `co-neptune-connection-${props.stage}`,
                connectionType: 'JDBC',
                physicalConnectionRequirements: {
                    subnetId: props.vpcResources.subnets[0].subnetId, // 'subnet-wersdfghj', // todo
                    availabilityZone: props.vpcResources.subnets[0].availabilityZone, //'us-east-1c', // todo
                    securityGroupIdList: [props.vpcResources.securityGroup.securityGroupId],
                },
                connectionProperties: {
                    JDBC_CONNECTION_URL: 'jdbc:wss://' + props.neptuneStack.endpoint + ':8182/gremlin',
                    JDBC_ENFORCE_SSL: "false",
                    PASSWORD: "dummy",
                    USERNAME: "dummy"
                }
            }
        })

        const ec2job = new glue.CfnJob(this, `co-get-ec2-data-job-${props.stage}`, {
            name: `co-get-ec2-data-job-${props.stage}`,
            role: inspectRole.roleArn,
            command: {
                name: "pythonshell",
                scriptLocation: `s3://${jobBucket.bucketName}/get-ec2-job.py`,
                pythonVersion: "3"
            },
            defaultArguments: {
                '--extra-py-files': `s3://${jobBucket.bucketName}/lib/neptune_python_utils.zip`,
                '--resource_ingestion_bucket_name': bucket.bucketName,
            },
            glueVersion: "1.0"
        })

        const transformJob = new glue.CfnJob(this, `co-transform-job-${props.stage}`, {
            name: `co-transform-job-${props.stage}`,
            role: transformRole.roleArn,
            command: {
                name: "glueetl",
                scriptLocation: `s3://${jobBucket.bucketName}/transform.py`,
                pythonVersion: "3"
            },
            defaultArguments: {
                '--extra-py-files': `s3://${jobBucket.bucketName}/lib/neptune_python_utils.zip`,
                '--resource_ingestion_bucket_name': bucket.bucketName,
                '--resource_database': glueDb.databaseName,
            },
            glueVersion: "2.0"
        })

        const bulkLoadJob = new glue.CfnJob(this, `co-bulk-load-job-${props.stage}`, {
            name: `co-bulk-load-job-${props.stage}`,
            role: bulkLoadRole.roleArn,
            command: {
                name: "pythonshell",
                scriptLocation: `s3://${jobBucket.bucketName}/bulk-load.py`,
                pythonVersion: "3"
            },
            connections: {
                connections: [(neptuneConnection.connectionInput as ConnectionInputProperty).name!!]
            },
            defaultArguments: {
                '--extra-py-files': `s3://${jobBucket.bucketName}/lib/neptune_python_utils-0.0.0-py3.6.egg`,
                '--neptune_connection_role': neptuneAccessRole.roleArn,
                '--neptune_connection_name': `co-neptune-connection-${props.stage}`, // todo!
                '--neptune_to_s3_role': props.neptuneStack.neptuneToS3Role.roleArn
            },
            glueVersion: "1.0"
        })

        const workflow = new glue.CfnWorkflow(this, `co-bulk-load-workflow-${props.stage}`, {
            name: `co-bulk-load-workflow-${props.stage}`
        })

        const startTrigger = new glue.CfnTrigger(this, `co-start-inspection-trigger-${props.stage}`, {
            name: `co-start-inspection-trigger-${props.stage}`,
            type: "ON_DEMAND", //Should be daily in prod
            workflowName: workflow.name,
            startOnCreation: false,
            actions: [{jobName: ec2job.name}]
        })
        startTrigger.addDependsOn(workflow)

        const loadedTrigger = new glue.CfnTrigger(this, `co-wait-until-loaded-trigger-${props.stage}`, {
            name: `co-wait-inspection-trigger-${props.stage}`,
            type: "CONDITIONAL",
            startOnCreation: false,
            actions: [{crawlerName: crawler.name}],
            predicate: {
                conditions: [{
                    logicalOperator: "EQUALS",
                    state: "SUCCEEDED",
                    jobName: ec2job.name
                }, /*add all raw load jobs here*/]
            },
            workflowName: workflow.name
        })
        loadedTrigger.addDependsOn(workflow)

        const crawledTrigger = new glue.CfnTrigger(this, `co-wait-until-crawl-complete-trigger-${props.stage}`, {
            name: `co-wait-until-crawl-complete-trigger-${props.stage}`,
            type: "CONDITIONAL",
            startOnCreation: false,
            actions: [{jobName: transformJob.name}],
            predicate: {
                conditions: [{
                    logicalOperator: "EQUALS",
                    crawlState: "SUCCEEDED",
                    crawlerName: crawler.name
                }, /*add all raw load jobs here*/]
            },
            workflowName: workflow.name
        })
        crawledTrigger.addDependsOn(workflow)

        const transformedTrigger = new glue.CfnTrigger(this, `co-wait-until-transformed-trigger-${props.stage}`, {
            name: `co-wait-until-transformed-trigger-${props.stage}`,
            type: "CONDITIONAL",
            startOnCreation: false,
            actions: [{jobName: bulkLoadJob.name}],
            predicate: {
                conditions: [{
                    logicalOperator: "EQUALS",
                    state: "SUCCEEDED",
                    jobName: transformJob.name
                }]
            },
            workflowName: workflow.name
        })
        transformedTrigger.addDependsOn(workflow)
    }
}
