$ErrorActionPreference = "Stop"

$ApiUrl = $env:API_URL
if (-not $ApiUrl) { $ApiUrl = "http://localhost:4000" }

$OwnerId = $env:LOCAL_OWNER_ID
if (-not $OwnerId) { $OwnerId = "00000000-0000-4000-8000-000000000001" }

$headers = @{
  "Content-Type" = "application/json"
  "x-user-id" = $OwnerId
}

function Invoke-Revealth {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [string]$Body = "{}"
  )
  if ($Method -eq "GET") {
    return Invoke-RestMethod -Method GET -Uri "$ApiUrl$Path" -Headers $headers
  }
  return Invoke-RestMethod -Method $Method -Uri "$ApiUrl$Path" -Headers $headers -Body $Body
}

function Wait-ForArtifactType {
  param(
    [Parameter(Mandatory = $true)][string]$WorkspaceId,
    [Parameter(Mandatory = $true)][string]$ArtifactType
  )
  for ($i = 0; $i -lt 90; $i++) {
    $artifacts = (Invoke-Revealth -Method GET -Path "/workspaces/$WorkspaceId/artifacts").data
    $artifact = $artifacts | Where-Object { $_.artifactType -eq $ArtifactType } | Select-Object -First 1
    if ($artifact) { return $artifact }
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for artifact type $ArtifactType"
}

function Get-ApprovalForArtifact {
  param(
    [Parameter(Mandatory = $true)][string]$WorkspaceId,
    [Parameter(Mandatory = $true)][string]$ArtifactId
  )
  for ($i = 0; $i -lt 30; $i++) {
    $approvals = (Invoke-Revealth -Method GET -Path "/workspaces/$WorkspaceId/approvals").data
    $approval = $approvals | Where-Object { $_.artifactId -eq $ArtifactId -and $_.status -eq "pending" } | Select-Object -First 1
    if ($approval) { return $approval }
    Start-Sleep -Seconds 1
  }
  throw "No pending approval found for artifact $ArtifactId"
}

function Approve-Artifact {
  param(
    [Parameter(Mandatory = $true)][string]$WorkspaceId,
    [Parameter(Mandatory = $true)]$Artifact,
    [Parameter(Mandatory = $true)][string]$Notes
  )
  $approval = Get-ApprovalForArtifact -WorkspaceId $WorkspaceId -ArtifactId $Artifact.id
  return Invoke-Revealth -Method POST -Path "/workspaces/$WorkspaceId/approvals/$($approval.id)/approve" -Body (@{ decisionNotes = $Notes } | ConvertTo-Json)
}

Write-Host "== Revealth v0.1 final smoke test =="

Invoke-Revealth -Method GET -Path "/health" | Out-Null

$workspaceName = "Revealth Smoke Test $(Get-Date -Format 'yyyyMMdd-HHmmss')"
$workspace = (Invoke-Revealth -Method POST -Path "/workspaces" -Body (@{ name = $workspaceName } | ConvertTo-Json)).data
Write-Host "Workspace: $($workspace.id)"

Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/workflows/intake" -Body (@{
  rawProjectIdea = "Build Revealth v0.1 as an autonomous AI software company operating system focused on governed planning, SDLC orchestration, task generation, audit logging, approval workflows, GitHub dry-run issue creation, and safe Codex execution readiness without live code execution."
} | ConvertTo-Json) | Out-Null

$projectBrief = Wait-ForArtifactType -WorkspaceId $workspace.id -ArtifactType "project_brief"
Approve-Artifact -WorkspaceId $workspace.id -Artifact $projectBrief -Notes "Smoke: approve project brief." | Out-Null

$sdlcPlan = Wait-ForArtifactType -WorkspaceId $workspace.id -ArtifactType "sdlc_plan"
Approve-Artifact -WorkspaceId $workspace.id -Artifact $sdlcPlan -Notes "Smoke: approve SDLC plan." | Out-Null

$taskBatch = Wait-ForArtifactType -WorkspaceId $workspace.id -ArtifactType "task_batch"
Approve-Artifact -WorkspaceId $workspace.id -Artifact $taskBatch -Notes "Smoke: approve task batch." | Out-Null

$githubBatch = Wait-ForArtifactType -WorkspaceId $workspace.id -ArtifactType "github_issue_batch"
Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/github/connections" -Body (@{ repository = "draft/repository" } | ConvertTo-Json) | Out-Null
Approve-Artifact -WorkspaceId $workspace.id -Artifact $githubBatch -Notes "Smoke: approve GitHub issue batch dry-run." | Out-Null

$issues = (Invoke-Revealth -Method GET -Path "/workspaces/$($workspace.id)/github/issues").data
if (-not ($issues | Where-Object { $_.dryRun -eq $true })) { throw "Expected at least one dry-run GitHub issue record." }

$codexPacket = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/task-batches/$($taskBatch.id)/task-packet-batches" -Body (@{ repository = "draft/repository" } | ConvertTo-Json)).data
Approve-Artifact -WorkspaceId $workspace.id -Artifact $codexPacket -Notes "Smoke: approve Codex packet batch." | Out-Null

$gitPlan = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/task-packet-batches/$($codexPacket.id)/git-execution-plans" -Body (@{ requiredReviewers = @("human-owner") } | ConvertTo-Json)).data
Approve-Artifact -WorkspaceId $workspace.id -Artifact $gitPlan -Notes "Smoke: approve Git execution plan." | Out-Null

$contract = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/git-execution-plans/$($gitPlan.id)/execution-contracts" -Body (@{ maxExecutionScope = "smoke-test dry-run only" } | ConvertTo-Json)).data
Approve-Artifact -WorkspaceId $workspace.id -Artifact $contract -Notes "Smoke: approve execution contract." | Out-Null

$run = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/execution-contracts/$($contract.id)/execution-runs").data
$dryRun = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/execution-runs/$($run.id)/start").data
if ($dryRun.status -ne "completed_dry_run") { throw "Expected completed_dry_run, received $($dryRun.status)" }

$controlPlane = (Invoke-Revealth -Method GET -Path "/workspaces/$($workspace.id)/control-plane").data
if (-not $controlPlane.lineage) { throw "Control plane lineage missing." }

Write-Host "Smoke test passed."
Write-Host "Workspace: $($workspace.id)"
Write-Host "Control plane: http://localhost:3000/workspaces/$($workspace.id)/control-plane"
