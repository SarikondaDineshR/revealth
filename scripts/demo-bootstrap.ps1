$ErrorActionPreference = "Stop"

Write-Host "== Revealth v0.1 demo bootstrap =="

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

function Set-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )
  $lines = Get-Content ".env"
  $updated = $false
  $lines = $lines | ForEach-Object {
    if ($_ -match "^$([regex]::Escape($Key))=") {
      $updated = $true
      "$Key=$Value"
    } else {
      $_
    }
  }
  if (-not $updated) {
    $lines += "$Key=$Value"
  }
  Set-Content ".env" $lines
}

Set-DotEnvValue -Key "GITHUB_ISSUE_CREATION_MODE" -Value "dry_run"
Set-DotEnvValue -Key "CODEX_EXECUTION_MODE" -Value "dry_run"

& "$PSScriptRoot\demo-doctor.ps1"

corepack pnpm install
docker compose up -d postgres temporal temporal-ui

Write-Host "Building application services..."
docker compose build api worker executor --progress=plain
docker compose up -d api worker executor

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
