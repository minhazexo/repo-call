#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { RepoCallStack } from "../lib/repocall-stack";

const app = new cdk.App();

// Deploys to us-east-1 by default (best Amazon Bedrock Nova availability).
// Override: CDK_DEFAULT_REGION=eu-west-1 npm run deploy --workspace=infra
new RepoCallStack(app, "RepoCallStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: "RepoCall developer context-recovery API (Lambda + HTTP API + Bedrock)",
});
