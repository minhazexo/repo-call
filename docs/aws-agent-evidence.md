# AWS Agent Evidence — RepoCall

> Build log: what the coding agent did with AWS, step by step. Updated after each phase.

## 1. How the agent was connected to AWS

Via the official **Agent Toolkit for AWS** setup flow (`setup.md`):

- Installed `uv` 0.12.22 and used the pre-installed **AWS CLI 2.37.8**.
- Authenticated with `aws login --profile repocall` (browser flow, no static keys).
  Credentials: account `678503489298`, root session, region `us-east-1`.
- Ran `aws configure agent-toolkit --yes --region us-east-1 --profile repocall`:
  24 default AWS skills installed; MCP `aws-mcp` entries added for Claude Code
  (`~/.claude.json`) and Cline (`~/.cline/mcp.json`).
- Patched both `aws-mcp` entries with `"env": {"AWS_MCP_PROXY_PROFILES": "repocall"}`.
- Verified with `aws agent-toolkit list-available-skills` (JSON catalog returned).
- Added advanced-experience rules to `AGENTS.md` (project root).
- Loaded the `aws-cdk` and `amazon-bedrock` skills and followed them
  (diff-before-deploy, Converse API, explicit maxTokens, model-access checks).

## 2. What the agent actually did

| # | Action | Result |
|---|---|---|
| 1 | Scaffolded monorepo + implemented API, frontend, CDK, docs | Committed locally |
| 2 | Local verify: typecheck, lint (0 warnings), 21/21 vitest, `vite build`, `cdk synth` | All green |
| 3 | Live local HTTP smoke test (`/health`, `INVALID_URL`, real GitHub collection) | Passed |
| 4 | `aws bedrock list-foundation-models` — Nova Lite + Nova Micro ACTIVE in us-east-1 | Confirmed |
| 5 | `cdk bootstrap aws://678503489298/us-east-1` (first attempt failed: account not yet activated; succeeded after owner completed signup) | Bootstrapped |
| 6 | `cdk diff` reviewed, then `cdk deploy` | `RepoCallStack` CREATE_COMPLETE in 58s |
| 7 | `GET /health` → `{"status":"ok"}` | Passed |
| 8 | CORS: preflight `204` + `GET` with `Origin` returns `access-control-allow-origin: *` | Passed |
| 9 | CloudWatch logs: invocations show START/END/REPORT, no exceptions | Passed |
| 10 | `POST /analyze` (axios/axios) → `success:true`, `meta.model: amazon.nova-lite-v1:0`: real goal/state/stop-point, 3 blockers, 3 risks, 3 prioritized actions, 13 evidence items, 0 off-repo URLs, 2 sampled evidence URLs return HTTP 200 | Passed |
| 11 | CloudWatch: Bedrock invocation REPORT 13.8 s, no exceptions | Passed |

## 3. AWS resources created by the agent

API base: `https://j5n58xfskf.execute-api.us-east-1.amazonaws.com/`

| Resource | Details |
|---|---|
| `RepoCallStack` (CloudFormation) | `arn:aws:cloudformation:us-east-1:678503489298:stack/RepoCallStack/bc7a0c80-…` |
| Lambda `RepoCallStack-AnalyzeFunction5A98DC09-tn8CpkJz6xav` | Node.js 20, ARM64, 512 MB, 90 s timeout |
| API Gateway HTTP API `RepoCall` | `$default` stage, routes `GET /health`, `POST /analyze` |
| IAM role policy | `bedrock:InvokeModel*` on Nova Lite + Nova Micro foundation-model ARNs |
| CloudWatch Log Group | `/aws/lambda/RepoCallStack-AnalyzeFunction5A98DC09-tn8CpkJz6xav`, 1-week retention |

Bedrock model: **`amazon.nova-lite-v1:0`** (primary) with automatic fallback to
**`amazon.nova-micro-v1:0`**, via the **Converse API**.

## 4. Blocker encountered and resolved

Brand-new AWS account initially refused Bedrock (*"account currently being verified"*)
and S3/CloudFormation (`NotSignedUp`/`OptInRequired`). Owner completed signup +
enabled **Nova Lite + Nova Micro** model access; agent retried and the full chain went
green. No code changes were needed — see row 10 above.

## 5. How deployment WAS verified (agent runbook, with results)

Backend (all performed by the agent against the live stack):

1. `GET {ApiUrl}/health` → `{"status":"ok"}` ✅
2. `POST {ApiUrl}/analyze` `{"repositoryUrl":"https://github.com/axios/axios"}` →
   `success:true`, `meta.model: amazon.nova-lite-v1:0`: real goal/state/stop-point, 2 blockers,
   3 prioritized actions, 6 evidence items, 0 off-repo URLs, 2 sampled evidence URLs return HTTP 200 ✅
3. CORS preflight + `Origin` request headers ✅
4. CloudWatch: Bedrock invocation REPORT ~14 s, no exceptions ✅
5. IAM: Lambda role holds only `bedrock:InvokeModel*` on the two Nova ARNs + basic execution ✅

Frontend (S3 static website, deployed by agent):

6. `aws s3 sync` → `s3://repocall-frontend-678503489298` → static website hosting enabled ✅
7. Public URL (S3 origin): http://repocall-frontend-678503489298.s3-website.us-east-1.amazonaws.com/
8. End-to-end test from S3 origin: `POST /analyze` with `Origin` header → 200, CORS `*`,
   full Nova Lite analysis, valid evidence links ✅

**CloudFront HTTPS distribution (added for production demo):**

9. Created CloudFront distribution `E1JVEPNMBMLDEX` with S3 website endpoint as custom origin
10. Domain: `https://d2k6169o8w197f.cloudfront.net/` (HTTPS, default CloudFront certificate)
11. Viewer protocol: Redirect HTTP → HTTPS
12. Custom error responses: 404/403 → `/index.html` (SPA fallback)
13. Compression enabled, managed cache policy (CachingOptimized)
14. Verified: `GET https://d2k6169o8w197f.cloudfront.net/` → 200, RepoCall landing page loads
15. Verified: `POST /analyze` from CloudFront origin → 200, CORS `*`, full Nova Lite analysis ✅
16. Verified: SPA fallback works (404 → index.html served correctly)

## 6. Screenshots captured (hackathon evidence)

1. `01-landing.png` — S3 website showing the RepoCall hero + URL input.
2. `02-loading.png` — skeleton UI mid-analysis.
3. `03-dashboard.png` — project overview + Resume-in-5-Minutes.
4. `04-evidence.png` — blockers, next 3 actions, evidence grid.
5. `05-api-proof.png` — terminal: `curl {ApiUrl}/health` → `{"status":"ok"}` plus
   `POST /analyze` returning `"success":true,"model":"amazon.nova-lite-v1:0"`.

**Production HTTPS URL:** https://d2k6169o8w197f.cloudfront.net/

**AWS Console verification (documented, not a repository screenshot):**
The agent verified all deployed AWS resources via CLI and SDK:
- CloudFormation: `RepoCallStack` CREATE_COMPLETE
- Lambda: `RepoCallStack-AnalyzeFunction5A98DC09-tn8CpkJz6xav` (Node.js 20, ARM64, 512 MB, 90s)
- API Gateway HTTP API: `RepoCall` with `GET /health` and `POST /analyze` routes
- Bedrock: Nova Lite + Nova Micro model access enabled in us-east-1
- S3: `repocall-frontend-678503489298` static website hosting enabled

No screenshot file is included for the console; the above CLI-verified resource list serves as the deployment evidence.

## 7. Remaining submission steps (owner)

- [ ] Enable Bedrock model access (Nova Lite + Nova Micro, us-east-1).
- [ ] Run `scripts/deploy-backend.ps1` with AWS credentials; record `ApiUrl`.
- [ ] Deploy frontend to S3 static website hosting; record public URL.
- [ ] Run the §5 verification; capture the §6 screenshots into `docs/screenshots/`.
- [ ] Fill the `Live demo` / `API` / `Screenshots` placeholders in `README.md`.
- [ ] Push to `https://github.com/minhazexo/repo-call` and submit.
