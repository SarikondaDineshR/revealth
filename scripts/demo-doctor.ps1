$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [int]$TimeoutSeconds = 30
  )

  Write-Host "Checking $Name..."
  $outputFile = New-TemporaryFile
  $errorFile = New-TemporaryFile
  try {
    $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -NoNewWindow -PassThru -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      throw "$Name timed out after $TimeoutSeconds seconds. If this is Docker/buildx, restart Docker Desktop or the Codespace/VM."
    }
    $process.Refresh()

    $stdout = Get-Content $outputFile -Raw
    $stderr = Get-Content $errorFile -Raw
    if ($null -ne $process.ExitCode -and $process.ExitCode -ne 0) {
      throw "$Name failed with exit code $($process.ExitCode). $stderr $stdout"
    }
    return $stdout
  } finally {
    Remove-Item $outputFile, $errorFile -Force -ErrorAction SilentlyContinue
  }
}

function Read-DotEnv {
  if (-not (Test-Path ".env")) {
    throw ".env is missing. Run: Copy-Item .env.example .env"
  }

  $values = @{}
  Get-Content ".env" | ForEach-Object {
    if ($_ -and -not $_.StartsWith("#") -and $_ -match "=") {
      $parts = $_ -split "=", 2
      $values[$parts[0]] = $parts[1]
    }
  }
  return $values
}

Write-Host "== Revealth demo doctor =="

Invoke-CheckedCommand -Name "node" -FilePath "node" -Arguments @("--version") | Out-Null
Invoke-CheckedCommand -Name "corepack" -FilePath "corepack" -Arguments @("--version") | Out-Null
Invoke-CheckedCommand -Name "pnpm" -FilePath "corepack" -Arguments @("pnpm", "--version") | Out-Null
Invoke-CheckedCommand -Name "docker engine" -FilePath "docker" -Arguments @("version") -TimeoutSeconds 45 | Out-Null
Invoke-CheckedCommand -Name "docker compose" -FilePath "docker" -Arguments @("compose", "version") -TimeoutSeconds 45 | Out-Null
Invoke-CheckedCommand -Name "docker buildx" -FilePath "docker" -Arguments @("buildx", "version") -TimeoutSeconds 45 | Out-Null

$envValues = Read-DotEnv

if ($envValues["DATABASE_URL"] -notmatch "127\.0\.0\.1:5433") {
  throw "DATABASE_URL must use 127.0.0.1:5433 for host-run Prisma commands."
}

if ($envValues["GITHUB_ISSUE_CREATION_MODE"] -ne "dry_run") {
  throw "GITHUB_ISSUE_CREATION_MODE must be dry_run for the v0.2 demo path."
}

if ($envValues["CODEX_EXECUTION_MODE"] -eq "live") {
  throw "CODEX_EXECUTION_MODE=live is not allowed for v0.2 Milestone 1."
}

if ($envValues["CODEX_EXECUTION_MODE"] -ne "dry_run") {
  Write-Host "Warning: CODEX_EXECUTION_MODE is not dry_run. demo:smoke requires dry_run."
}

Write-Host "Demo doctor passed."
