# Revealth Codespaces Bootstrap

This guide runs Revealth from GitHub Codespaces so local laptop Docker or disk pressure does not block development.

## What Codespaces Provides

- Node.js 20
- Corepack with pnpm `9.15.4`
- Docker-in-Docker with Docker Compose v2
- Forwarded ports:
  - `3000`: web
  - `4000`: API
  - `7233`: Temporal gRPC
  - `8080`: Temporal UI

The devcontainer post-create script copies `.env.example` to `.env` only if `.env` does not already exist, enables Corepack, prepares pnpm, installs dependencies, and verifies Docker/Compose availability.

## Safe Environment Defaults

`.env.example` is safe to commit. It uses local-only values and blank secret fields:

- Host-run Prisma uses `127.0.0.1:5433`.
- Docker services override API and worker `DATABASE_URL` to use `postgres:5432`.
- `GITHUB_ISSUE_CREATION_MODE=dry_run`.
- `GITHUB_TOKEN` and provider API keys are blank.

Do not put real secrets in `.env.example`.

## Bootstrap Commands

From the Codespaces terminal at the repository root:

```bash
corepack pnpm install
corepack pnpm demo:doctor
docker compose up -d postgres temporal temporal-ui
corepack pnpm db:generate
corepack pnpm db:deploy
corepack pnpm db:seed
docker compose build api worker executor --progress=plain
docker compose up -d api worker executor
```

For the shortest demo path, run:

```bash
corepack pnpm demo:bootstrap
corepack pnpm demo:smoke
```

`demo:doctor` fails fast when Docker, Compose, or buildx is not responding. If Docker hangs before build output reaches `loading Dockerfile`, treat it as a Codespaces Docker/buildx failure rather than a Revealth application failure.

Check containers:

```bash
docker compose ps
```

Expected services:

- `revealth-postgres`
- `revealth-temporal`
- `revealth-temporal-ui`
- `revealth-api`
- `revealth-worker`

## First API Health Check

```bash
curl -fsS http://localhost:4000/health | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d), null, 2)))"
```

Expected response shape:

```json
{
  "data": {
    "status": "ok",
    "service": "revealth-api",
    "timestamp": "2026-05-23T00:00:00.000Z"
  },
  "error": null,
  "requestId": "generated-request-id"
}
```

## First Workflow Test

Create a workspace:

```bash
WORKSPACE_RESPONSE=$(
  curl -fsS \
    -X POST \
    http://localhost:4000/workspaces \
    -H "Content-Type: application/json" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
    -d '{ "name": "Revealth Codespaces Intake Test" }'
)

WORKSPACE_ID=$(
  printf '%s' "$WORKSPACE_RESPONSE" |
    node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.id))"
)

echo "$WORKSPACE_ID"
```

Start the intake workflow:

```bash
curl -fsS \
  -X POST \
  "http://localhost:4000/workspaces/$WORKSPACE_ID/workflows/intake" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -d '{ "rawProjectIdea": "Build Revealth v0.1 as an autonomous AI software company operating system focused only on governed project planning, SDLC orchestration, task generation, audit logging, approvals, and safe execution preparation." }' |
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d), null, 2)))"
```

Inspect artifacts:

```bash
sleep 5

curl -fsS \
  "http://localhost:4000/workspaces/$WORKSPACE_ID/artifacts" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" |
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d).data.map(a=>({ id:a.id, type:a.artifactType, status:a.status })), null, 2)))"
```

Expected outcome:

- API returns a queued intake workflow run.
- Worker creates a `project_brief` artifact.
- Artifact enters `pending_approval`.
- An approval record exists.
- Audit events are written.
- Temporal UI is available on forwarded port `8080`.

## Optional Web App

The API and worker run through Docker Compose. To run the Next.js web app in Codespaces:

```bash
corepack pnpm --filter @revealth/web dev
```

Open forwarded port `3000`.

## Troubleshooting

If the API is not ready immediately after `docker compose up -d`, wait for builds and health checks:

```bash
docker compose ps
docker compose logs api --tail=80
docker compose logs worker --tail=80
docker compose logs executor --tail=80
```

If Prisma cannot connect, confirm Postgres is healthy and that host-run Prisma is using `127.0.0.1:5433`:

```bash
docker compose ps postgres
grep DATABASE_URL .env
```
