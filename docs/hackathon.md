# RepoCall — Hackathon Notes (AWS Zero to Shipped)

> Honest build log. No fabricated metrics, no invented user studies.

## Project story

Every developer knows the feeling: you open a repository you haven't touched in months and think, *"what was I even doing here?"* The README is stale, the commit history is a blur, and there are open issues you half-remember. Reconstructing that working context — goal, state, stopping point, next step — takes 30–60 minutes of archaeology per repo.

RepoCall compresses that into one click: paste a public repo URL, get a **context-recovery dashboard** (goal, current state, completed work, stopping point, blockers, risks, next 3 actions, a 5-minute resume briefing), with every claim linked to the commit / issue / file / README section that supports it.

## Why this problem matters

- Unfinished projects are the norm (side projects, hackathons, spikes, handoffs), not the exception.
- Context loss is the tax on revisiting them — and it compounds with every dormant month.
- Existing tools summarize *what the code is*; none reconstruct *where the human left off*.

## Why an agent is useful here

A summarizer reads the README. A **context-recovery agent** weighs *multiple, sometimes conflicting signals* — recent commits vs. old docs, open issues vs. merged work, config files vs. prose — and forms a judgment about *human intent and progress*. That synthesis (goal → state → stop point → blockers → next actions) is exactly the agentic step, and grounding each conclusion in cited evidence is what makes it trustworthy instead of a hallucination machine.

## AWS architecture

- **API Gateway HTTP API** — `GET /health`, `POST /analyze`, CORS for the public frontend.
- **Lambda (Node.js 20, ARM)** — validates the URL, collects bounded GitHub evidence, calls Bedrock, validates + filters the model output.
- **Amazon Bedrock, Converse API** — Nova Lite primary, Nova Micro automatic fallback, `us-east-1`. Strict-JSON system prompt with untrusted-data framing and an evidence-URL allowlist.
- **IAM** — least privilege: `bedrock:InvokeModel*` on the two Nova foundation-model ARNs only.
- **CloudWatch Logs** — one-week retention.
- **S3 Static Website Hosting** — public React/Vite/Tailwind frontend.

See the Mermaid diagram in `README.md`.

## How the coding agent was used

The agent (OpenCode / Muse Spark session) scaffolded the monorepo, implemented the backend collector + Bedrock client, the frontend dashboard, the CDK stack, docs, and the deploy script; then ran the full local verification suite (typecheck, lint, unit tests, frontend build, `cdk synth`). AWS deployment itself requires the owner's credentials + Bedrock model-access enablement, so the agent prepared a one-command deploy script (`scripts/deploy-backend.ps1`) plus a step-by-step verification checklist in `docs/aws-agent-evidence.md`. Full, honest details there — including what the agent could *not* do from its sandbox.

## Development decisions

- **npm workspaces monorepo** (`apps/web`, `apps/api`, `infra`) — understandable, no extra tooling.
- **HTTP API, not REST API** — cheaper, simpler, CORS-native; all we need is two routes.
- **`NodejsFunction`** — TypeScript bundling built into CDK, no separate build pipeline.
- **Bounded evidence** (20 commits / 20 issues / 12 files / ~120 KB, lockfiles + binaries excluded) — keeps Bedrock prompts small, fast, and cheap.
- **Nova Lite → Nova Micro fallback** — cost-conscious, and the retry doubles reliability.
- **Evidence allowlist enforced server-side** — invented URLs are dropped, not displayed.
- **`ENABLE_HEURISTIC_FALLBACK` defaults to false** — production failures surface as honest errors; the deterministic fallback exists only for local UI work and labels itself.

## Challenges

- **No AWS credentials or network-to-AWS in the agent sandbox** — solved by making everything verifiable locally (vitest, `cdk synth`, dev servers) and scripting the deploy + verification so the owner can run it in minutes.
- **Bedrock output discipline** — solved with a strict-JSON system prompt, fence-stripping, schema coercion, and allowlist filtering, with graceful `BEDROCK_ERROR` states in the UI.
- **GitHub rate limits / huge repos** — solved with caps, prioritized file selection, per-file failure tolerance, and explicit `429` handling with `Retry-After`.

## Deployment process

1. `aws configure` (keys with CloudFormation/Lambda/APIGW/IAM/Logs rights) + enable Nova Lite/Micro in Bedrock console.
2. `powershell -ExecutionPolicy Bypass -File ./scripts/deploy-backend.ps1` — installs, typechecks, tests, bootstraps, deploys, then hits `/health` and a real `/analyze`.
3. Build frontend (`$env:VITE_API_BASE_URL=... npm run build --workspace=apps/web`) and deploy to S3 static website hosting.
4. Run the post-deploy verification in `docs/aws-agent-evidence.md`.

## Demo instructions (under 2 minutes)

Good demo repos (meaningful README, many commits, open issues): `axios/axios`, `vercel/swr`, `sveltejs/kit`.

1. Open the S3 website URL (0:00).
2. Paste `https://github.com/axios/axios`, click **Recover Context** (0:10).
3. While it works, note the skeleton + “collecting evidence → Bedrock” caption (0:20).
4. Show **Project Goal** and **Where You Stopped** (0:50).
5. Scroll to **Blockers** → **Next 3 Actions** (1:10).
6. Click an **Evidence** card — it opens the real GitHub commit/issue (1:30).
7. Close: “Generated by Amazon Bedrock, grounded in N repository sources — links in the footer prove it.” (1:50).

## Known limitations

- Public repos only; anonymous GitHub limits (60/hr) unless `GITHUB_TOKEN` is set.
- Evidence is sampled on large repos (dashboard shows truncation).
- Single-request latency of 30–90s; no streaming yet.
- Bedrock reasoning is probabilistic — evidence links let judges verify every claim.

## Future ideas

GitHub OAuth + private repos · PR/CI signals · analysis history & diffs · streaming progress · multi-repo “what was I doing everywhere?” mode.
