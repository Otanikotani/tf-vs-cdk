#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import {Environment} from "@aws-cdk/core";
import {NeptuneClusterStack} from "../lib/neptune-cluster-stack";
import {NetworkStack} from "../lib/network-stack";
import {OrchestrationStack} from '../lib/orchestration-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'dev';
const env: Environment = {
    account: '11111111111111',
    region: 'us-east-1',
};

const networkStack = new NetworkStack(app, `co-NetworkStack-${stage}`, {env, stage})
const neptuneStack = new NeptuneClusterStack(app, `co-NeptuneClusterStack-${stage}`, {
    env,
    vpcResources: networkStack,
    stage
});

const orchestrationStack = new OrchestrationStack(app, `co-OrchestrationStack-${stage}`, {
    env,
    vpcResources: networkStack,
    stage,
    neptuneStack: neptuneStack,
});
