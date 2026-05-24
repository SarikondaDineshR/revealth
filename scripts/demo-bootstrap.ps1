$ErrorActionPreference = "Stop"

Write-Host "== Revealth v0.1 demo bootstrap =="

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

corepack pnpm install
docker compose up -d

Write-Host "Waiting for containers..."
Start-Sleep -Seconds 8

corepack pnpm db:generate
corepack pnpm db:deploy
corepack pnpm db:seed

Write-Host "Health checks"
docker compose ps
Invoke-RestMethod -Method GET -Uri "http://localhost:4000/health" | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method GET -Uri "http://localhost:4100/health" | ConvertTo-Json -Depth 4

Write-Host "Demo bootstrap complete."
Write-Host "Open http://localhost:3000/workspaces or run: corepack pnpm demo:smoke"
