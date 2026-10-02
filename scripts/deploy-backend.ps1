<#
  Deploys the RepoCall backend to AWS (us-east-1 by default).
  Prerequisites:
    - Node.js 20+, AWS CLI v2, AWS credentials with rights for
      CloudFormation, Lambda, API Gateway, IAM, Logs + Bedrock model access.
    - `npm install` completed at the repo root.
    - Bedrock model access enabled in the console for:
        amazon.nova-lite-v1:0  and  amazon.nova-micro-v1:0
  Usage:
    powershell -ExecutionPolicy Bypass -File ./scripts/deploy-backend.ps1
    # with a GitHub token for higher rate limits:
    $env:GITHUB_TOKEN = "ghp_..."
    powershell -ExecutionPolicy Bypass -File ./scripts/deploy-backend.ps1
#>
$ErrorActionPreference = "Stop"

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$env:CDK_DEFAULT_REGION = $Region
if ($env:AWS_REGION) { $env:AWS_REGION = $Region }

Write-Host "== RepoCall backend deploy ==" -ForegroundColor Cyan
Write-Host "Region: $Region"

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command '$name' not found. See README.md deployment section."
  }
}

Require-Command node
Require-Command npm
Require-Command aws

Write-Host "-- Verifying AWS identity --" -ForegroundColor Cyan
aws sts get-caller-identity --region $Region
if ($LASTEXITCODE -ne 0) { throw "AWS authentication failed. Run 'aws configure' first." }

Write-Host "-- Installing dependencies --" -ForegroundColor Cyan
npm install

Write-Host "-- Typecheck + tests --" -ForegroundColor Cyan
npm run typecheck --workspace=apps/api
npm run test --workspace=apps/api

Write-Host "-- Bootstrapping CDK (one-time per account/region) --" -ForegroundColor Cyan
npx --workspace=infra cdk bootstrap "aws://unknown-account/$Region"

Write-Host "-- Deploying RepoCallStack --" -ForegroundColor Cyan
npx --workspace=infra cdk deploy --require-approval never

Write-Host "" 
Write-Host "== Verifying deployment ==" -ForegroundColor Cyan
$ApiUrl = (aws cloudformation describe-stacks --stack-name RepoCallStack --region $Region --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
Write-Host "API URL: $ApiUrl"
Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get | Format-List
Write-Host ""
Write-Host "Smoke-test analysis (Bedrock, may take ~30-60s):" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$ApiUrl/analyze" -Method Post -ContentType "application/json" -Body '{"repositoryUrl":"https://github.com/axios/axios"}' -TimeoutSec 180 |
  Select-Object success, meta | Format-List
