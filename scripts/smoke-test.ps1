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

Write-Host "== Revealth demo smoke test =="

Invoke-Revealth -Method GET -Path "/health" | Out-Null

$workspaceName = "Real Estate CRM Showcase $(Get-Date -Format 'yyyyMMdd-HHmmss')"
$workspace = (Invoke-Revealth -Method POST -Path "/workspaces" -Body (@{ name = $workspaceName } | ConvertTo-Json)).data
Write-Host "Workspace: $($workspace.id)"

Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/workflows/intake" -Body (@{
  rawProjectIdea = "Build a real estate CRM platform for boutique brokerages. It should manage contacts, buyer and seller leads, property preferences, showing notes, follow-up reminders, deal stages, and simple reporting. The demo must use fake client data only, require owner approval before client-facing communication, and avoid live code execution or external outreach."
} | ConvertTo-Json) | Out-Null

$projectBrief = Wait-ForArtifactType -WorkspaceId $workspace.id -ArtifactType "project_brief"
Approve-Artifact -WorkspaceId $workspace.id -Artifact $projectBrief -Notes "Demo: project brief approved. The founder wants the team to continue planning the real estate CRM." | Out-Null

$sdlcPlan = Wait-ForArtifactType -WorkspaceId $workspace.id -ArtifactType "sdlc_plan"
Approve-Artifact -WorkspaceId $workspace.id -Artifact $sdlcPlan -Notes "Demo: SDLC plan approved. Continue into task breakdown with approval gates intact." | Out-Null

$taskBatch = Wait-ForArtifactType -WorkspaceId $workspace.id -ArtifactType "task_batch"
Approve-Artifact -WorkspaceId $workspace.id -Artifact $taskBatch -Notes "Demo: task batch approved. Prepare a believable AI workforce recommendation." | Out-Null
$workforcePlan = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/artifacts/$($taskBatch.id)/workforce-scaling-plans").data
if ($workforcePlan.artifactType -ne "workforce_scaling_plan") { throw "Expected workforce_scaling_plan artifact." }
if ($workforcePlan.status -ne "pending_approval") { throw "Expected workforce_scaling_plan pending approval." }
Approve-Artifact -WorkspaceId $workspace.id -Artifact $workforcePlan -Notes "Demo: approve AI team scaling. Activate the team for simulated coordination only." | Out-Null
$activation = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/artifacts/$($workforcePlan.id)/workforce/activate").data
if ($activation.status -ne "activated") { throw "Expected activated workforce, received $($activation.status)" }
if ($activation.createdAssignments.Count -lt 1) { throw "Expected workforce activation to create assignments." }
$dispatch = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/workforce/dispatch").data
if ($dispatch.createdDispatchCount -lt 1) { throw "Expected workforce dispatch to create work records." }

Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/agent-messages" -Body (@{
  agentId = "ceo"
  agentRole = "CEO Agent"
  messageType = "decision"
  visibility = "internal"
  message = "Scope stays focused: prove the CRM workflow, approval loop, and client-safe communication before any automation is expanded."
} | ConvertTo-Json) | Out-Null

Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/agent-messages" -Body (@{
  agentId = "product_manager"
  agentRole = "Product Manager Agent"
  messageType = "update"
  visibility = "client_visible"
  message = "The team has mapped the CRM around lead capture, showing notes, follow-up reminders, and broker owner approvals."
} | ConvertTo-Json) | Out-Null

Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/agent-messages" -Body (@{
  agentId = "designer"
  agentRole = "Designer Agent"
  messageType = "handoff"
  visibility = "internal"
  message = "Handoff complete: workflow sketches are ready for frontend review once the owner approves the next artifact."
} | ConvertTo-Json) | Out-Null

Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/agent-messages" -Body (@{
  agentId = "qa"
  agentRole = "QA Agent"
  messageType = "blocker"
  visibility = "internal"
  message = "Risk detected: client-visible updates must remain simulated until consent and outbound policy are explicitly approved."
} | ConvertTo-Json) | Out-Null

$client = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/clients" -Body (@{
  name = "Maya Chen"
  company = "Harbor & Pine Realty"
  email = "maya.chen@example.test"
  status = "lead"
  source = "showcase_demo"
  notes = "Broker-owner evaluating a CRM for agents who lose follow-ups after showings and open houses."
} | ConvertTo-Json)).data

$lead = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/leads" -Body (@{
  clientProfileId = $client.id
  title = "Real estate CRM platform"
  needSummary = "Maya needs contact management, buyer/seller lead tracking, showing notes, reminders, and a simple pipeline dashboard for five agents."
  budgetRange = "demo estimate: $25k-$45k"
  urgency = "high"
  stage = "discovery"
  ownerAgentRole = "Sales Agent"
} | ConvertTo-Json)).data

Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/client-conversations" -Body (@{
  clientProfileId = $client.id
  agentRole = "Sales Agent"
  channel = "simulated_chat"
  visibility = "client_visible"
  message = "Client-safe update: the team is preparing a discovery script around lead follow-up gaps, showing notes, and broker reporting."
  approvalRequired = $true
} | ConvertTo-Json) | Out-Null

$meetingRequest = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/meeting-requests" -Body (@{
  clientProfileId = $client.id
  requestedByAgentRole = "Customer Success Agent"
  purpose = "Simulated discovery review with Maya Chen about CRM workflow priorities"
  status = "pending_approval"
  consentRequired = $true
} | ConvertTo-Json)).data
if ($meetingRequest.externalJoinEnabled -ne $false) { throw "Expected meeting request externalJoinEnabled to remain false." }

$clientScript = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/leads/$($lead.id)/client-communication-scripts").data
if ($clientScript.artifactType -ne "client_communication_script") { throw "Expected client_communication_script artifact." }
if ($clientScript.status -ne "pending_approval") { throw "Expected client_communication_script pending approval." }

$policyEvaluation = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/client-communication/policy/evaluate" -Body (@{
  channel = "email_draft"
  clientProfileId = $client.id
  leadId = $lead.id
  scriptArtifactId = $clientScript.id
} | ConvertTo-Json)).data
if ($policyEvaluation.allowed -ne $false) { throw "Expected external communication policy to block email_draft by default." }
if (-not ($policyEvaluation.blockers | Where-Object { $_ -eq "consent_granted_required" })) {
  throw "Expected policy evaluation to require granted consent for external channels."
}
Approve-Artifact -WorkspaceId $workspace.id -Artifact $clientScript -Notes "Demo: approve internal script draft for the CRM discovery conversation. No outreach is allowed." | Out-Null

$communicationDraft = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/client-communication/drafts" -Body (@{
  clientProfileId = $client.id
  leadId = $lead.id
  scriptArtifactId = $clientScript.id
  channel = "email_draft"
  createdByAgentRole = "Sales Agent"
} | ConvertTo-Json)).data
if ($communicationDraft.status -ne "pending_approval") { throw "Expected communication draft pending approval." }
if ($communicationDraft.channel -ne "email_draft") { throw "Expected email_draft communication draft." }
if ($communicationDraft.body -notmatch "No email") { throw "Expected communication draft to state no external sending occurred." }

$draftApproval = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/client-communication/drafts/$($communicationDraft.id)/approve" -Body (@{
  decisionNotes = "Demo: approve draft readiness only. Keep the CRM client message internal."
} | ConvertTo-Json)).data
if ($draftApproval.draft.status -ne "approved") { throw "Expected approved communication draft." }
if ($draftApproval.authorization.status -ne "authorized_draft_only") { throw "Expected authorized_draft_only outbound authorization." }
if ($draftApproval.authorization.externalSendEnabled -ne $false) { throw "Expected outbound authorization externalSendEnabled false." }

$reviewPackage = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/client-communication/outbound-review-packages" -Body (@{
  communicationDraftId = $draftApproval.draft.id
  outboundAuthorizationId = $draftApproval.authorization.id
} | ConvertTo-Json)).data
if ($reviewPackage.status -ne "ready_for_human_review") { throw "Expected outbound review package ready_for_human_review." }
if ($reviewPackage.externalSendEnabled -ne $false) { throw "Expected outbound review package externalSendEnabled false." }
if (-not ($reviewPackage.blockers | Where-Object { $_ -eq "external_send_disabled" })) {
  throw "Expected outbound review package to include external_send_disabled blocker."
}

$githubBatch = Wait-ForArtifactType -WorkspaceId $workspace.id -ArtifactType "github_issue_batch"
Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/github/connections" -Body (@{ repository = "draft/repository" } | ConvertTo-Json) | Out-Null
Approve-Artifact -WorkspaceId $workspace.id -Artifact $githubBatch -Notes "Demo: approve GitHub issue dry-run records only." | Out-Null

$issues = (Invoke-Revealth -Method GET -Path "/workspaces/$($workspace.id)/github/issues").data
if (-not ($issues | Where-Object { $_.dryRun -eq $true })) { throw "Expected at least one dry-run GitHub issue record." }

$codexPacket = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/task-batches/$($taskBatch.id)/task-packet-batches" -Body (@{ repository = "draft/repository" } | ConvertTo-Json)).data
Approve-Artifact -WorkspaceId $workspace.id -Artifact $codexPacket -Notes "Demo: approve Codex packets for planning only." | Out-Null

$gitPlan = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/task-packet-batches/$($codexPacket.id)/git-execution-plans" -Body (@{ requiredReviewers = @("human-owner") } | ConvertTo-Json)).data
Approve-Artifact -WorkspaceId $workspace.id -Artifact $gitPlan -Notes "Demo: approve Git execution plan artifact only. No branch creation." | Out-Null

$contract = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/git-execution-plans/$($gitPlan.id)/execution-contracts" -Body (@{ maxExecutionScope = "showcase dry-run only" } | ConvertTo-Json)).data
Approve-Artifact -WorkspaceId $workspace.id -Artifact $contract -Notes "Demo: approve dry-run execution contract. Live execution remains blocked." | Out-Null

$run = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/execution-contracts/$($contract.id)/execution-runs").data
$dryRun = (Invoke-Revealth -Method POST -Path "/workspaces/$($workspace.id)/codex/execution-runs/$($run.id)/start").data
if ($dryRun.status -ne "completed_dry_run") { throw "Expected completed_dry_run, received $($dryRun.status)" }

$controlPlane = (Invoke-Revealth -Method GET -Path "/workspaces/$($workspace.id)/control-plane").data
if (-not $controlPlane.lineage) { throw "Control plane lineage missing." }
if (-not $controlPlane.agentAssignments -or $controlPlane.agentAssignments.Count -lt 3) {
  throw "Control plane AI team assignments missing."
}
if (-not $controlPlane.clientVisibleAgentMessages -or $controlPlane.clientVisibleAgentMessages.Count -lt 1) {
  throw "Control plane client-visible agent updates missing."
}
if (-not $controlPlane.workforceScalingPlans -or $controlPlane.workforceScalingPlans.Count -lt 1) {
  throw "Control plane workforce scaling plan missing."
}
if (-not $controlPlane.activatedWorkforceAssignments -or $controlPlane.activatedWorkforceAssignments.Count -lt 1) {
  throw "Control plane activated workforce assignments missing."
}
if (-not $controlPlane.workforceDispatches -or $controlPlane.workforceDispatches.Count -lt 1) {
  throw "Control plane workforce dispatches missing."
}
if (-not $controlPlane.recentWorkforceHandoffs -or $controlPlane.recentWorkforceHandoffs.Count -lt 1) {
  throw "Control plane workforce handoffs missing."
}
if (-not $controlPlane.clients -or $controlPlane.clients.Count -lt 1) {
  throw "Control plane client profiles missing."
}
if (-not $controlPlane.leads -or $controlPlane.leads.Count -lt 1) {
  throw "Control plane leads missing."
}
if (-not $controlPlane.clientConversations -or $controlPlane.clientConversations.Count -lt 1) {
  throw "Control plane client conversations missing."
}
if (-not $controlPlane.meetingRequests -or $controlPlane.meetingRequests.Count -lt 1) {
  throw "Control plane meeting requests missing."
}
if (-not $controlPlane.clientCommunicationScripts -or $controlPlane.clientCommunicationScripts.Count -lt 1) {
  throw "Control plane client communication scripts missing."
}
if (-not $controlPlane.externalCommunicationPolicies -or $controlPlane.externalCommunicationPolicies.Count -lt 1) {
  throw "Control plane external communication policies missing."
}
if (-not $controlPlane.latestExternalCommunicationPolicyEvaluation) {
  throw "Control plane external communication policy evaluation missing."
}
if (-not $controlPlane.communicationDrafts -or $controlPlane.communicationDrafts.Count -lt 1) {
  throw "Control plane communication drafts missing."
}
if (-not $controlPlane.outboundAuthorizations -or $controlPlane.outboundAuthorizations.Count -lt 1) {
  throw "Control plane outbound authorizations missing."
}
if (-not ($controlPlane.outboundAuthorizations | Where-Object { $_.externalSendEnabled -eq $false })) {
  throw "Expected outbound authorization to keep externalSendEnabled false."
}
if (-not $controlPlane.outboundReviewPackages -or $controlPlane.outboundReviewPackages.Count -lt 1) {
  throw "Control plane outbound review packages missing."
}
if (-not ($controlPlane.outboundReviewPackages | Where-Object { $_.externalSendEnabled -eq $false })) {
  throw "Expected outbound review package to keep externalSendEnabled false."
}

Write-Host "Smoke test passed."
Write-Host "Workspace: $($workspace.id)"
Write-Host "Control plane: http://localhost:3000/workspaces/$($workspace.id)/control-plane"
Write-Host "Company command center: http://localhost:3000/workspaces/$($workspace.id)/company"
