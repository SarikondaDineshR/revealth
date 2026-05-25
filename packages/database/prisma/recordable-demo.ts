import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ownerId = process.env.LOCAL_OWNER_ID ?? "00000000-0000-4000-8000-000000000001";
const ownerEmail = process.env.LOCAL_OWNER_EMAIL ?? "founder@revealth.local";
const workspaceId = process.env.RECORDABLE_DEMO_WORKSPACE_ID ?? "22222222-2222-4222-8222-222222222222";

const ids = {
  workflowRun: "33333333-3333-4333-8333-333333333333",
  projectBrief: "44444444-4444-4444-8444-444444444444",
  sdlcPlan: "55555555-5555-4555-8555-555555555555",
  taskBatch: "66666666-6666-4666-8666-666666666666",
  githubIssueBatch: "77777777-7777-4777-8777-777777777777",
  workforcePlan: "88888888-8888-4888-8888-888888888888",
  clientScript: "99999999-9999-4999-8999-999999999999",
  taskFrontend: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  taskBackend: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  taskQa: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  client: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  lead: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  draft: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  policy: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};

const base = new Date("2026-05-24T16:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(base.getTime() - minutes * 60_000);

async function resetRecordableWorkspace(): Promise<void> {
  const where = { workspaceId };

  await prisma.outboundReviewPackage.deleteMany({ where });
  await prisma.outboundAuthorization.deleteMany({ where });
  await prisma.communicationDraft.deleteMany({ where });
  await prisma.externalCommunicationPolicy.deleteMany({ where });
  await prisma.meetingRequest.deleteMany({ where });
  await prisma.clientConversation.deleteMany({ where });
  await prisma.clientLead.deleteMany({ where });
  await prisma.clientProfile.deleteMany({ where });
  await prisma.gitHubIssue.deleteMany({ where });
  await prisma.gitHubIssueDraft.deleteMany({ where });
  await prisma.gitHubConnection.deleteMany({ where });
  await prisma.codexExecutionRun.deleteMany({ where });
  await prisma.workforceDispatch.deleteMany({ where });
  await prisma.agentMessage.deleteMany({ where });
  await prisma.agentAssignment.deleteMany({ where });
  await prisma.auditLog.deleteMany({ where });
  await prisma.approval.deleteMany({ where });
  await prisma.agentRun.deleteMany({ where });
  await prisma.task.deleteMany({ where });
  await prisma.artifact.deleteMany({ where });
  await prisma.workflowRun.deleteMany({ where });
  await prisma.memoryEntry.deleteMany({ where });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
}

async function main(): Promise<void> {
  await resetRecordableWorkspace();

  await prisma.user.upsert({
    where: { id: ownerId },
    update: { email: ownerEmail, name: "Local Founder" },
    create: { id: ownerId, email: ownerEmail, name: "Local Founder" },
  });

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      ownerId,
      name: "Real Estate CRM Platform",
      status: "active",
      createdAt: minutesAgo(34),
    },
  });

  await prisma.workflowRun.create({
    data: {
      id: ids.workflowRun,
      workspaceId,
      workflowType: "recordable_showcase",
      status: "waiting_for_approval",
      inputJson: {
        scenario: "Real Estate CRM Platform",
        note: "Deterministic recordable demo state. No external actions are performed.",
      },
      outputJson: {
        currentStage: "Review Needed",
        nextSafeStep: "Owner reviews pending GitHub issue batch and communication draft.",
      },
      createdAt: minutesAgo(34),
      completedAt: minutesAgo(4),
    },
  });

  await prisma.artifact.createMany({
    data: [
      {
        id: ids.projectBrief,
        workspaceId,
        sourceWorkflowRunId: ids.workflowRun,
        artifactType: "project_brief",
        version: 1,
        status: "approved",
        schemaVersion: "revealth.project_brief.v1",
        contentJson: {
          schemaVersion: "revealth.project_brief.v1",
          projectBriefId: ids.projectBrief,
          problem: "Boutique real estate teams lose follow-ups after open houses, showings, and buyer calls.",
          targetUsers: ["Broker owner", "Real estate agents", "Operations assistant"],
          businessGoals: ["Increase follow-up consistency", "Centralize lead context", "Show owner-level pipeline visibility"],
          knownConstraints: ["Use fake demo data only", "No external outreach", "Owner approval required"],
          openQuestions: ["Which lead sources matter first?", "What reporting cadence does the broker need?"],
          assumptions: ["Five-agent brokerage", "Manual import in MVP"],
          riskFlags: ["Client data handling must be reviewed before production"],
          sourceIds: [],
        },
        generatedByAgent: "Product Manager Agent",
        promptVersion: "recordable_demo.v1",
        modelProvider: "seeded",
        modelName: "deterministic",
        createdAt: minutesAgo(31),
      },
      {
        id: ids.sdlcPlan,
        workspaceId,
        parentArtifactId: ids.projectBrief,
        sourceWorkflowRunId: ids.workflowRun,
        artifactType: "sdlc_plan",
        version: 1,
        status: "approved",
        schemaVersion: "revealth.sdlc_plan.v1",
        contentJson: {
          schemaVersion: "revealth.sdlc_plan.v1",
          sdlcPlanId: ids.sdlcPlan,
          phases: [
            {
              phaseName: "Discovery and workflow mapping",
              objective: "Map contact, showing, reminder, and pipeline flows.",
              dependencies: ["Approved project brief"],
              exitCriteria: ["Owner confirms CRM workflow scope"],
              approvalRequired: true,
            },
            {
              phaseName: "Task planning",
              objective: "Break CRM work into safe implementation packets.",
              dependencies: ["Approved SDLC plan"],
              exitCriteria: ["Task batch includes acceptance criteria"],
              approvalRequired: true,
            },
          ],
          sourceIds: [ids.projectBrief],
        },
        sourceArtifactIds: [ids.projectBrief],
        generatedByAgent: "Engineering Manager Agent",
        promptVersion: "recordable_demo.v1",
        modelProvider: "seeded",
        modelName: "deterministic",
        createdAt: minutesAgo(27),
      },
      {
        id: ids.taskBatch,
        workspaceId,
        parentArtifactId: ids.sdlcPlan,
        sourceWorkflowRunId: ids.workflowRun,
        artifactType: "task_batch",
        version: 1,
        status: "approved",
        schemaVersion: "revealth.task_batch.v1",
        contentJson: {
          schemaVersion: "revealth.task_batch.v1",
          taskBatchId: ids.taskBatch,
          tasks: [
            {
              taskId: ids.taskFrontend,
              title: "Design CRM command center screens",
              description: "Create simple views for contacts, leads, showing notes, reminders, and owner pipeline review.",
              type: "feature",
              priority: "p1",
              dependencies: [],
              acceptanceCriteria: ["Broker can scan leads by stage", "Reminder status is visible", "No real client data is required"],
              approvalRequired: true,
              sourceArtifactId: ids.taskBatch,
            },
            {
              taskId: ids.taskBackend,
              title: "Plan CRM data boundaries",
              description: "Define safe demo-only entities for contacts, leads, notes, and reminders.",
              type: "research",
              priority: "p1",
              dependencies: [],
              acceptanceCriteria: ["No secrets stored", "No real passwords or client data", "Audit events remain visible"],
              approvalRequired: true,
              sourceArtifactId: ids.taskBatch,
            },
            {
              taskId: ids.taskQa,
              title: "Review safety and demo risks",
              description: "Verify that client communication and execution remain simulated.",
              type: "test",
              priority: "p2",
              dependencies: [],
              acceptanceCriteria: ["External send remains disabled", "Live execution remains disabled", "Approval queue is visible"],
              approvalRequired: true,
              sourceArtifactId: ids.taskBatch,
            },
          ],
          sourceIds: [ids.sdlcPlan],
        },
        sourceArtifactIds: [ids.sdlcPlan],
        generatedByAgent: "Engineering Manager Agent",
        promptVersion: "recordable_demo.v1",
        modelProvider: "seeded",
        modelName: "deterministic",
        createdAt: minutesAgo(23),
      },
      {
        id: ids.githubIssueBatch,
        workspaceId,
        parentArtifactId: ids.taskBatch,
        sourceWorkflowRunId: ids.workflowRun,
        artifactType: "github_issue_batch",
        version: 1,
        status: "pending_approval",
        schemaVersion: "revealth.github_issue_batch.v1",
        contentJson: {
          schemaVersion: "revealth.github_issue_batch.v1",
          githubIssueBatchId: ids.githubIssueBatch,
          repository: "draft/real-estate-crm",
          issues: [
            {
              title: "Draft CRM lead tracking task",
              body: "Dry-run issue draft only. Do not create a GitHub issue externally.",
              labels: ["demo", "crm", "dry-run"],
              milestone: null,
              assignees: [],
              sourceTaskId: ids.taskBackend,
            },
          ],
          approvalRequired: true,
          sourceIds: [ids.taskBatch],
        },
        sourceArtifactIds: [ids.taskBatch],
        generatedByAgent: "Engineering Manager Agent",
        promptVersion: "recordable_demo.v1",
        modelProvider: "seeded",
        modelName: "deterministic",
        createdAt: minutesAgo(13),
      },
      {
        id: ids.workforcePlan,
        workspaceId,
        parentArtifactId: ids.taskBatch,
        sourceWorkflowRunId: ids.workflowRun,
        artifactType: "workforce_scaling_plan",
        version: 1,
        status: "approved",
        schemaVersion: "revealth.workforce_scaling_plan.v1",
        contentJson: {
          schemaVersion: "revealth.workforce_scaling_plan.v1",
          workforceScalingPlanId: ids.workforcePlan,
          sourceTaskBatchArtifactId: ids.taskBatch,
          projectComplexity: "medium",
          requiredRoles: [
            { role: "Product Manager Agent", recommendedAgentCount: 1, reason: "Clarify broker workflows and approval checkpoints." },
            { role: "Designer Agent", recommendedAgentCount: 1, reason: "Make CRM screens easy for non-technical agents." },
            { role: "Backend Developer Agent", recommendedAgentCount: 1, reason: "Plan lead, contact, notes, and reminder data boundaries." },
            { role: "QA Agent", recommendedAgentCount: 1, reason: "Guard client data, consent, and external action boundaries." },
          ],
          assignmentStrategy: "Keep the AI team small, visible, and approval-gated.",
          expectedBottlenecks: ["Approval timing", "Client data handling review", "Outbound communication policy"],
          humanReadableSummary: "A focused AI team is enough for the CRM demo. The owner should approve issue drafts and communication drafts before anything moves forward.",
          approvalRequired: true,
          automaticAgentCreationAllowed: false,
          sourceIds: [ids.taskBatch],
        },
        sourceArtifactIds: [ids.taskBatch],
        generatedByAgent: "CEO Agent",
        promptVersion: "recordable_demo.v1",
        modelProvider: "seeded",
        modelName: "deterministic",
        createdAt: minutesAgo(20),
      },
      {
        id: ids.clientScript,
        workspaceId,
        sourceWorkflowRunId: ids.workflowRun,
        artifactType: "client_communication_script",
        version: 1,
        status: "approved",
        schemaVersion: "revealth.client_communication_script.v1",
        contentJson: {
          schemaVersion: "revealth.client_communication_script.v1",
          clientCommunicationScriptId: ids.clientScript,
          targetClient: { clientProfileId: ids.client, name: "Maya Chen", company: "Harbor & Pine Realty" },
          leadId: ids.lead,
          objective: "Confirm CRM workflow priorities without sending any external message.",
          discoveryQuestions: [
            "Where do agents lose follow-ups today?",
            "Which lead stages matter for broker reporting?",
            "What reminders should be visible first?",
          ],
          valueProposition: "A lightweight CRM that helps agents remember the next best follow-up after every showing or open house.",
          objectionHandling: [
            {
              objection: "We do not want another complicated system.",
              response: "The MVP focuses only on contacts, lead stages, showing notes, and reminders.",
            },
          ],
          nextStepRecommendation: "Owner reviews the draft before any future client-facing action.",
          approvalRequired: true,
          externalCommunicationAllowed: false,
          sourceIds: [ids.lead],
        },
        generatedByAgent: "Sales Agent",
        promptVersion: "recordable_demo.v1",
        modelProvider: "seeded",
        modelName: "deterministic",
        createdAt: minutesAgo(12),
      },
    ],
  });

  await prisma.approval.createMany({
    data: [
      {
        workspaceId,
        artifactId: ids.projectBrief,
        artifactVersion: 1,
        status: "approved",
        approverId: ownerId,
        decisionNotes: "Approved for recordable demo planning.",
        decidedAt: minutesAgo(29),
        createdAt: minutesAgo(30),
      },
      {
        workspaceId,
        artifactId: ids.sdlcPlan,
        artifactVersion: 1,
        status: "approved",
        approverId: ownerId,
        decisionNotes: "Approved to break work into CRM tasks.",
        decidedAt: minutesAgo(25),
        createdAt: minutesAgo(26),
      },
      {
        workspaceId,
        artifactId: ids.taskBatch,
        artifactVersion: 1,
        status: "approved",
        approverId: ownerId,
        decisionNotes: "Approved task batch for simulated dispatch.",
        decidedAt: minutesAgo(21),
        createdAt: minutesAgo(22),
      },
      {
        workspaceId,
        artifactId: ids.githubIssueBatch,
        artifactVersion: 1,
        status: "pending",
        decisionNotes: null,
        createdAt: minutesAgo(13),
      },
      {
        workspaceId,
        artifactId: ids.workforcePlan,
        artifactVersion: 1,
        status: "approved",
        approverId: ownerId,
        decisionNotes: "Approved AI team scaling for simulation only.",
        decidedAt: minutesAgo(18),
        createdAt: minutesAgo(19),
      },
      {
        workspaceId,
        artifactId: ids.clientScript,
        artifactVersion: 1,
        status: "approved",
        approverId: ownerId,
        decisionNotes: "Approved internal client communication script. No external outreach.",
        decidedAt: minutesAgo(11),
        createdAt: minutesAgo(12),
      },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        id: ids.taskFrontend,
        workspaceId,
        sourceArtifactId: ids.taskBatch,
        title: "Design CRM command center screens",
        description: "Create simple CRM views for contacts, leads, reminders, and broker reporting.",
        taskType: "feature",
        priority: "p1",
        status: "in_progress",
        acceptanceCriteria: ["Broker can scan lead stages", "Reminder state is visible", "No real client data is used"],
        createdAt: minutesAgo(22),
      },
      {
        id: ids.taskBackend,
        workspaceId,
        sourceArtifactId: ids.taskBatch,
        title: "Plan CRM data boundaries",
        description: "Plan demo-safe entities for contacts, leads, notes, and reminders.",
        taskType: "research",
        priority: "p1",
        status: "review",
        acceptanceCriteria: ["No secrets", "No real passwords", "Audit events visible"],
        createdAt: minutesAgo(22),
      },
      {
        id: ids.taskQa,
        workspaceId,
        sourceArtifactId: ids.taskBatch,
        title: "Review safety and demo risks",
        description: "Confirm the system remains simulation-only.",
        taskType: "test",
        priority: "p2",
        status: "blocked",
        acceptanceCriteria: ["External send disabled", "Live execution disabled", "Owner approval visible"],
        createdAt: minutesAgo(22),
      },
    ],
  });

  await prisma.agentAssignment.createMany({
    data: [
      { workspaceId, agentId: "ceo", role: "CEO Agent", currentTask: "Keeping the CRM demo focused on safe, approval-gated progress", status: "waiting_for_approval", assignedArtifactId: ids.githubIssueBatch, startedAt: minutesAgo(19), createdAt: minutesAgo(19) },
      { workspaceId, agentId: "product_manager", role: "Product Manager Agent", currentTask: "Turning broker workflow into a clear CRM scope", status: "working", assignedArtifactId: ids.taskBatch, startedAt: minutesAgo(18), createdAt: minutesAgo(18) },
      { workspaceId, agentId: "designer", role: "Designer Agent", currentTask: "Sketching lead pipeline, showing notes, and reminder screens", status: "working", assignedArtifactId: ids.taskBatch, startedAt: minutesAgo(17), createdAt: minutesAgo(17) },
      { workspaceId, agentId: "backend_developer", role: "Backend Developer Agent", currentTask: "Reviewing safe demo data boundaries for contacts and notes", status: "review", assignedArtifactId: ids.taskBatch, startedAt: minutesAgo(16), createdAt: minutesAgo(16) },
      { workspaceId, agentId: "qa", role: "QA Agent", currentTask: "Blocking external send until consent and owner approval are explicit", status: "blocked", assignedArtifactId: ids.clientScript, startedAt: minutesAgo(15), createdAt: minutesAgo(15) },
      { workspaceId, agentId: "sales", role: "Sales Agent", currentTask: "Preparing a client-safe CRM discovery update", status: "waiting_for_approval", assignedArtifactId: ids.clientScript, startedAt: minutesAgo(14), createdAt: minutesAgo(14) },
      { workspaceId, agentId: "customer_success", role: "Customer Success Agent", currentTask: "Drafting next-step language for Maya Chen", status: "idle", assignedArtifactId: ids.clientScript, startedAt: minutesAgo(13), createdAt: minutesAgo(13) },
      { workspaceId, agentId: "devops", role: "DevOps Agent", currentTask: "Confirming no deployment, branch creation, or live execution is enabled", status: "completed", assignedArtifactId: null, startedAt: minutesAgo(12), completedAt: minutesAgo(8), createdAt: minutesAgo(12) },
    ],
  });

  await prisma.workforceDispatch.createMany({
    data: [
      { workspaceId, taskId: ids.taskFrontend, assignedAgentId: "designer", assignedAgentRole: "Designer Agent", assignmentReason: "Design owns the CRM workflow screens before implementation planning.", estimatedComplexity: "medium", status: "in_progress", startedAt: minutesAgo(17), createdAt: minutesAgo(17) },
      { workspaceId, taskId: ids.taskBackend, assignedAgentId: "backend_developer", assignedAgentRole: "Backend Developer Agent", assignmentReason: "Backend reviews contact, lead, note, and reminder boundaries.", estimatedComplexity: "medium", status: "review", startedAt: minutesAgo(16), createdAt: minutesAgo(16) },
      { workspaceId, taskId: ids.taskQa, assignedAgentId: "qa", assignedAgentRole: "QA Agent", assignmentReason: "QA verifies client communication and execution safety before demo narration.", estimatedComplexity: "small", status: "blocked", startedAt: minutesAgo(15), createdAt: minutesAgo(15) },
    ],
  });

  await prisma.agentMessage.createMany({
    data: [
      { workspaceId, agentId: "ceo", agentRole: "CEO Agent", messageType: "decision", visibility: "internal", message: "We will show controlled progress, not uncontrolled autonomy. The next safe step is owner approval.", createdAt: minutesAgo(2) },
      { workspaceId, agentId: "product_manager", agentRole: "Product Manager Agent", messageType: "update", visibility: "client_visible", message: "The CRM plan is organized around contact history, buyer and seller stages, showing notes, and follow-up reminders.", createdAt: minutesAgo(5) },
      { workspaceId, agentId: "designer", agentRole: "Designer Agent", messageType: "handoff", visibility: "internal", message: "Handoff complete: lead pipeline and reminder screens are ready for engineering review after approval.", createdAt: minutesAgo(7) },
      { workspaceId, agentId: "backend_developer", agentRole: "Backend Developer Agent", messageType: "review", visibility: "internal", message: "Review requested: confirm fake demo data boundaries before any future implementation planning.", createdAt: minutesAgo(9) },
      { workspaceId, agentId: "qa", agentRole: "QA Agent", messageType: "blocker", visibility: "internal", message: "Risk detected: external sending, live execution, branch creation, and PR creation are all still blocked.", createdAt: minutesAgo(11) },
      { workspaceId, agentId: "sales", agentRole: "Sales Agent", messageType: "question", visibility: "client_visible", message: "Waiting for owner approval before turning this CRM discovery draft into any future client-facing action.", createdAt: minutesAgo(13) },
      { workspaceId, agentId: "customer_success", agentRole: "Customer Success Agent", messageType: "update", visibility: "client_visible", message: "Client update prepared: Maya will see a simple story about fewer missed follow-ups after showings.", createdAt: minutesAgo(15) },
    ],
  });

  await prisma.clientProfile.create({
    data: {
      id: ids.client,
      workspaceId,
      name: "Maya Chen",
      company: "Harbor & Pine Realty",
      email: "maya.chen@example.test",
      phone: "555-0100",
      status: "prospect",
      source: "recordable_demo",
      notes: "Broker-owner evaluating a CRM for a five-agent boutique brokerage. Fake demo contact only.",
      createdAt: minutesAgo(16),
    },
  });

  await prisma.clientLead.create({
    data: {
      id: ids.lead,
      workspaceId,
      clientProfileId: ids.client,
      title: "Real Estate CRM Platform",
      needSummary: "Maya needs a simple CRM for leads, showing notes, reminders, agent follow-up, and broker reporting.",
      budgetRange: "demo estimate: $25k-$45k",
      urgency: "high",
      stage: "waiting_for_approval",
      ownerAgentRole: "Sales Agent",
      createdAt: minutesAgo(15),
    },
  });

  await prisma.clientConversation.createMany({
    data: [
      {
        workspaceId,
        clientProfileId: ids.client,
        agentRole: "Sales Agent",
        channel: "simulated_chat",
        visibility: "client_visible",
        message: "Client-safe update drafted: the AI team is preparing a CRM discovery plan around missed follow-ups and broker reporting.",
        approvalRequired: true,
        createdAt: minutesAgo(10),
      },
      {
        workspaceId,
        clientProfileId: ids.client,
        agentRole: "Customer Success Agent",
        channel: "internal_note",
        visibility: "internal",
        message: "Do not send externally. Keep the next step as an owner review package for the recording.",
        approvalRequired: true,
        createdAt: minutesAgo(8),
      },
    ],
  });

  await prisma.meetingRequest.create({
    data: {
      workspaceId,
      clientProfileId: ids.client,
      requestedByAgentRole: "Customer Success Agent",
      purpose: "Simulated CRM workflow review with Maya Chen",
      proposedTime: new Date("2026-05-25T15:00:00.000Z"),
      status: "pending_approval",
      consentRequired: true,
      externalJoinEnabled: false,
      createdAt: minutesAgo(9),
    },
  });

  const policyEvaluation = {
    allowed: false,
    blockers: ["consent_granted_required", "owner_approval_required", "external_send_disabled"],
    requiredApprovals: ["Owner must approve any future outbound action."],
    requiredConsent: ["Client consent must be granted before external communication."],
    nextSafeAction: "Review the internal draft only.",
  } satisfies Prisma.JsonObject;

  await prisma.externalCommunicationPolicy.create({
    data: {
      id: ids.policy,
      workspaceId,
      clientProfileId: ids.client,
      leadId: ids.lead,
      allowedChannel: "email_draft",
      consentState: "required",
      clientApproved: false,
      leadApproved: true,
      ownerApprovalRequired: true,
      auditRequired: true,
      status: "blocked",
      notes: "Recordable demo policy blocks real external communication.",
      createdAt: minutesAgo(8),
    },
  });

  await prisma.communicationDraft.create({
    data: {
      id: ids.draft,
      workspaceId,
      clientProfileId: ids.client,
      leadId: ids.lead,
      scriptArtifactId: ids.clientScript,
      channel: "email_draft",
      subject: "Draft only: CRM workflow next steps",
      body: "Internal draft only. Hi Maya, the team mapped the CRM around contacts, showing notes, reminders, and broker reporting. No email has been sent.",
      status: "pending_approval",
      policyEvaluationJson: policyEvaluation,
      createdByAgentRole: "Sales Agent",
      createdAt: minutesAgo(6),
    },
  });

  await prisma.auditLog.createMany({
    data: [
      { workspaceId, workflowRunId: ids.workflowRun, actorType: "system", actorId: "recordable-demo", action: "recordable_demo.reset", status: "succeeded", eventJson: { workspaceId }, createdAt: minutesAgo(34) },
      { workspaceId, workflowRunId: ids.workflowRun, actorType: "agent", actorId: "product_manager", action: "artifact.created", targetArtifactIds: [ids.projectBrief], status: "succeeded", eventJson: { artifactType: "project_brief" }, createdAt: minutesAgo(31) },
      { workspaceId, workflowRunId: ids.workflowRun, actorType: "human", actorId: ownerId, action: "approval.approved", targetArtifactIds: [ids.projectBrief], status: "succeeded", eventJson: { notes: "Project brief approved." }, createdAt: minutesAgo(29) },
      { workspaceId, workflowRunId: ids.workflowRun, actorType: "agent", actorId: "engineering_manager", action: "workforce.dispatch.started", targetArtifactIds: [ids.taskBatch], status: "succeeded", eventJson: { dispatchCount: 3 }, createdAt: minutesAgo(17) },
      { workspaceId, workflowRunId: ids.workflowRun, actorType: "agent", actorId: "qa", action: "workforce.dispatch.blocker", targetArtifactIds: [ids.clientScript], status: "blocked", errorCode: "EXTERNAL_ACTION_BLOCKED", eventJson: { reason: "External communication remains disabled." }, createdAt: minutesAgo(11) },
      { workspaceId, workflowRunId: ids.workflowRun, actorType: "agent", actorId: "sales", action: "communication_draft.generated", targetArtifactIds: [ids.clientScript], status: "succeeded", eventJson: { draftId: ids.draft, externalSendEnabled: false }, createdAt: minutesAgo(6) },
      { workspaceId, workflowRunId: ids.workflowRun, actorType: "system", actorId: "recordable-demo", action: "recordable_demo.ready", status: "succeeded", eventJson: { nextSafeStep: "Owner reviews pending approvals." }, createdAt: minutesAgo(1) },
    ],
  });

  console.log("Recordable demo seeded.");
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Control plane: http://localhost:3000/workspaces/${workspaceId}/control-plane`);
  console.log(`Company command center: http://localhost:3000/workspaces/${workspaceId}/company`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
