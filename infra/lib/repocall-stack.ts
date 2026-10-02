import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

/**
 * RepoCall backend stack (minimal, cost-conscious).
 *
 * Resources:
 * - Lambda (Node.js 20, bundled TypeScript handler)
 * - API Gateway HTTP API ($default stage, CORS open for the public frontend)
 * - CloudWatch Log Group (1-week retention)
 * - IAM least-privilege Bedrock invoke permissions (Nova Lite + Nova Micro)
 */
export class RepoCallStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const primaryModel = this.node.tryGetContext("bedrockModel") ?? "amazon.nova-lite-v1:0";
    const fallbackModel =
      this.node.tryGetContext("bedrockFallbackModel") ?? "amazon.nova-micro-v1:0";
    const allowedOrigins: string[] = this.node.tryGetContext("allowedOrigins") ?? ["*"];

    const fn = new nodejs.NodejsFunction(this, "AnalyzeFunction", {
      entry: "../apps/api/src/index.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(90),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        BEDROCK_MODEL_ID: primaryModel,
        BEDROCK_FALLBACK_MODEL_ID: fallbackModel,
        // Optional: `GITHUB_TOKEN=ghp_... cdk deploy` raises the GitHub
        // rate limit from 60/hr to 5,000/hr. Never commit a token.
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? "",
        ALLOWED_ORIGINS: allowedOrigins.join(","),
        ENABLE_HEURISTIC_FALLBACK: "false",
      },
      bundling: {
        minify: true,
        target: "node20",
        sourceMap: true,
        // Bundle the Bedrock SDK so the deployed version is pinned.
        externalModules: [],
      },
    });

    // Least privilege: converse/invoke on the two Nova foundation models only.
    // (The Converse API is authorized via bedrock:InvokeModel*.)
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/${primaryModel}`,
          `arn:aws:bedrock:${this.region}::foundation-model/${fallbackModel}`,
        ],
      }),
    );

    const httpApi = new apigwv2.HttpApi(this, "RepoCallHttpApi", {
      apiName: "RepoCall",
      description: "RepoCall developer context-recovery API",
      createDefaultStage: true,
      corsPreflight: {
        allowOrigins: allowedOrigins,
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
        maxAge: cdk.Duration.days(1),
      },
    });

    const integration = new integrations.HttpLambdaIntegration("AnalyzeIntegration", fn);
    httpApi.addRoutes({ path: "/health", methods: [apigwv2.HttpMethod.GET], integration });
    httpApi.addRoutes({ path: "/analyze", methods: [apigwv2.HttpMethod.POST], integration });

    new cdk.CfnOutput(this, "ApiUrl", {
      description: "Base URL of the RepoCall HTTP API",
      value: httpApi.url ?? "",
    });
    new cdk.CfnOutput(this, "HealthUrl", {
      description: "GET health-check URL",
      value: `${httpApi.url}health`,
    });
    new cdk.CfnOutput(this, "AnalyzeUrl", {
      description: "POST analyze URL",
      value: `${httpApi.url}analyze`,
    });
    new cdk.CfnOutput(this, "FunctionName", {
      description: "Lambda function name (for log inspection)",
      value: fn.functionName,
    });
  }
}
