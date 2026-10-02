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
| 10 | `POST /analyze` (axios/axios): GitHub evidence collected OK; Bedrock blocked, see §5 | Partial |

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

## 4. Known blocker (owner action, in progress)

Brand-new AWS account: Bedrock returns *"Your account is currently being verified…
you may not have access to this operation."* Everything else in the chain is proven
working (GitHub collection succeeds inside Lambda; only the Bedrock call is refused).
Owner steps: (a) Bedrock console → Model access → enable Nova Lite + Nova Micro,
(b) wait for account verification (< 2 h typical), then tell the agent to retry
`POST /analyze`. No redeploy needed.

## 5. How deployment WAS verified (agent runbook, with results)

Backend (all performed by the agent against the live stack):

1. `GET {ApiUrl}/health` → `{"status":"ok"}` ✅
2. `POST {ApiUrl}/analyze` `{"repositoryUrl":"https://github.com/axios/axios"}` →
   GitHub evidence collected; Bedrock pending account verification ⏳ (retry after §4)
3. CORS preflight + `Origin` request headers ✅ (see §2 row 8)
4. CloudWatch log tail: clean invocations, no exceptions ✅
5. IAM: Lambda role holds only `bedrock:InvokeModel*` on the two Nova ARNs + basic execution ✅

Frontend (owner steps — requires GitHub push + Amplify console):

6. `git remote add origin https://github.com/minhazexo/repo-call.git; git push -u origin master`
7. Amplify → Host web app → connect repo, set `VITE_API_BASE_URL=https://j5n58xfskf.execute-api.us-east-1.amazonaws.com`
8. Open the Amplify URL, run a real analysis, click evidence links, check console.

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
