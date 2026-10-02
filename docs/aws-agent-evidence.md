# AWS Agent Evidence — RepoCall

> This document records honestly what the coding agent did and did not do with AWS,
> so the hackathon submission never over-claims.

## 1. How the agent was connected to AWS

**The agent was NOT connected to AWS at build time.** The sandbox had:

- ❌ no AWS CLI (`aws` not installed)
- ❌ no AWS credentials (`AWS_ACCESS_KEY_ID` / profiles absent)
- ❌ no AWS MCP / Agent Toolkit tooling available in the session
- ✅ Node.js 24 + npm (used for the full local build & verification)

The owner chose “I’ll provide access keys” for deployment, to happen **after** the build.
Therefore **no AWS resources were created, modified, or inspected by the agent**. Everything
below that requires AWS is a prepared, runnable procedure — not a completed action.

## 2. What the agent actually did (verifiable locally)

| # | Action | How to verify |
|---|---|---|
| 1 | Scaffolded monorepo (`apps/web`, `apps/api`, `infra`, `docs`, `amplify.yml`, deploy script) | `ls` the repo |
| 2 | Implemented Lambda API: `GET /health`, `POST /analyze`, GitHub collector, Bedrock Converse client | Read `apps/api/src/` |
| 3 | Implemented React dashboard with all required states + localStorage | Read `apps/web/src/` |
| 4 | Wrote CDK stack (HTTP API + Lambda + IAM least-privilege + logs) | Read `infra/lib/repocall-stack.ts` |
| 5 | `npm run typecheck` across workspaces | Re-run, expect 0 errors |
| 6 | `npm run lint` (eslint, zero-warning policy) | Re-run, expect clean |
| 7 | `npm run test --workspace=apps/api` (vitest: validate, collector utils, Bedrock allowlist, router) | Re-run, expect all pass |
| 8 | Frontend `vite build` | Re-run `npm run build --workspace=apps/web` |
| 9 | `cdk synth` (no credentials needed) | Re-run `npm run synth --workspace=infra`, inspect `cdk.out/` |

## 3. AWS actions performed by the agent

**None.** No `sts:get-caller-identity`, no `cdk deploy`, no console changes, no log inspection.
Any submission text must say the deployment was performed by the owner following the prepared
procedure — or update this file after a live agent-driven deploy.

## 4. Resources to be created (by `scripts/deploy-backend.ps1`)

| Resource | Details |
|---|---|
| `RepoCallStack` (CloudFormation) | us-east-1 |
| Lambda `RepoCallStack-AnalyzeFunction…` | Node.js 20, ARM64, 512 MB, 90 s timeout |
| API Gateway HTTP API `RepoCall` | `$default` stage, routes `GET /health`, `POST /analyze` |
| IAM role policy | `bedrock:InvokeModel*` on Nova Lite + Nova Micro foundation-model ARNs |
| CloudWatch Log Group | `/aws/lambda/RepoCallStack-AnalyzeFunction…`, 1-week retention |
| Amplify app (console steps in README) | hosts `apps/web/dist`, env `VITE_API_BASE_URL` |

Bedrock model used: **`amazon.nova-lite-v1:0`** (primary) with automatic fallback to
**`amazon.nova-micro-v1:0`**, via the **Converse API**.

## 5. How deployment WILL be verified (owner runbook)

After running `scripts/deploy-backend.ps1`:

1. `GET {ApiUrl}/health` → `{"status":"ok"}` (script does this automatically).
2. `POST {ApiUrl}/analyze` `{"repositoryUrl":"https://github.com/axios/axios"}` → `success:true`,
   `meta.model` starts with `amazon.nova-` (script smoke-tests this).
3. Open the Amplify URL publicly; run a real analysis end-to-end.
4. Confirm Bedrock output sections render (goal, stopping point, blockers, next actions).
5. Click 2–3 evidence cards → they open real GitHub commits/issues/files.
6. DevTools console: no errors; Network tab: `/analyze` is `200`.
7. CORS: response includes `access-control-allow-origin`.
8. CloudWatch: `aws logs tail /aws/lambda/<FunctionName> --follow` shows the invocation, no exceptions.

## 6. Screenshots to capture (hackathon evidence)

1. `01-landing.png` — Amplify URL showing the RepoCall hero + URL input.
2. `02-loading.png` — skeleton UI mid-analysis.
3. `03-dashboard-top.png` — project overview + Resume-in-5-Minutes.
4. `04-dashboard-actions-evidence.png` — blockers, next 3 actions, evidence grid.
5. `05-api-proof.png` — terminal: `curl {ApiUrl}/health` → `{"status":"ok"}` plus
   `POST /analyze` returning `"success":true,"model":"amazon.nova-lite-v1:0"`.
6. `06-aws-console.png` — (a) API Gateway `RepoCall` routes, (b) Lambda function overview,
   (c) Bedrock → Model access showing Nova Lite/Micro enabled, (d) Amplify deployment “Deployed”.
7. `07-logs.png` — CloudWatch log stream for a successful invocation (redact account IDs if you prefer).

## 7. Remaining submission steps (owner)

- [ ] Enable Bedrock model access (Nova Lite + Nova Micro, us-east-1).
- [ ] Run `scripts/deploy-backend.ps1` with AWS credentials; record `ApiUrl`.
- [ ] Amplify: connect repo, set `VITE_API_BASE_URL`, deploy; record public URL.
- [ ] Run the §5 verification; capture the §6 screenshots into `docs/screenshots/`.
- [ ] Fill the `Live demo` / `API` / `Screenshots` placeholders in `README.md`.
- [ ] Push to `https://github.com/minhazexo/repo-call` and submit.
