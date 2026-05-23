import crypto from "node:crypto";
import type { GenerateJsonInput, GenerateJsonResult, ModelProvider } from "./provider.js";
import { validateGeneratedJson } from "./provider.js";

function deterministicUuid(seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export class LocalModelProvider implements ModelProvider {
  readonly name = "local";

  async generateJson<T>(input: GenerateJsonInput): Promise<GenerateJsonResult<T>> {
    const seed = `${input.schemaName}:${input.user}`;
    const lowerSchemaName = input.schemaName.toLowerCase();
    const sourceId = deterministicUuid(`${seed}:source`);

    let json: unknown;
    if (lowerSchemaName.includes("project_brief")) {
      json = {
        schemaVersion: "revealth.project_brief.v1",
        projectBriefId: deterministicUuid(`${seed}:brief`),
        problem: "The submitted software idea needs to be converted into a governed implementation plan.",
        targetUsers: ["Founder owner", "Investor or venture studio operator", "Business owner"],
        businessGoals: ["Produce an approved project plan", "Generate SDLC tasks with acceptance criteria"],
        knownConstraints: ["No autonomous deployment in v0.1", "No GitHub issue creation without approval"],
        openQuestions: ["Which repository should receive approved GitHub issues?"],
        assumptions: ["The project is in planning mode and has no existing repository context yet."],
        riskFlags: ["Approval bypass", "Vague task generation"],
        sourceIds: [],
      };
    } else if (lowerSchemaName.includes("product_plan")) {
      json = {
        schemaVersion: "revealth.product_plan.v1",
        productPlanId: deterministicUuid(`${seed}:product`),
        mission: "Create a reliable AI software company operating system for planning and SDLC task generation.",
        personas: [
          {
            name: "Founder Owner",
            goals: ["Turn an idea into an approved implementation backlog"],
            painPoints: ["Unstructured AI output", "Lack of engineering management process"],
          },
        ],
        mvpScope: ["Project planning", "SDLC orchestration", "Task generation", "Approval workflows"],
        outOfScope: ["Autonomous deployment", "Autonomous production code execution", "Billing automation"],
        successMetrics: ["Approved task batch generated", "All tasks contain acceptance criteria"],
        assumptions: ["Human owner remains approval authority."],
        sourceIds: [sourceId],
      };
    } else if (lowerSchemaName.includes("sdlc_plan")) {
      json = {
        schemaVersion: "revealth.sdlc_plan.v1",
        sdlcPlanId: deterministicUuid(`${seed}:sdlc`),
        phases: [
          {
            phaseName: "Foundation",
            objective: "Establish governed project planning, approval, audit, and artifact lineage foundations.",
            dependencies: [],
            exitCriteria: ["Project brief is approved", "Lineage-bearing SDLC plan is pending approval"],
            approvalRequired: true,
          },
          {
            phaseName: "Task Generation",
            objective: "Convert approved planning artifacts into SDLC tasks with acceptance criteria.",
            dependencies: ["Foundation"],
            exitCriteria: ["Task batch is generated", "Every task has acceptance criteria"],
            approvalRequired: true,
          },
        ],
        sourceIds: [sourceId],
      };
    } else if (lowerSchemaName.includes("task_batch")) {
      const taskBatchId = deterministicUuid(`${seed}:task-batch`);
      json = {
        schemaVersion: "revealth.task_batch.v1",
        taskBatchId,
        tasks: [
          {
            taskId: deterministicUuid(`${seed}:task-1`),
            title: "Implement approval-gated artifact lineage",
            description:
              "Persist lineage metadata for downstream artifacts and block invalid workflow chaining.",
            type: "feature",
            priority: "p1",
            dependencies: [],
            acceptanceCriteria: [
              "Artifact records include upstream artifact, workflow, approval, prompt, and model metadata.",
              "Downstream workflow starts are blocked unless upstream artifacts are approved.",
            ],
            approvalRequired: true,
            sourceArtifactId: sourceId,
          },
        ],
        sourceIds: [sourceId],
      };
    } else {
      throw new Error(`Local provider has no deterministic fixture for schema ${input.schemaName}.`);
    }

    const data = validateGeneratedJson(input.schema, json) as T;
    return { data, rawText: JSON.stringify(data), provider: this.name, model: input.model };
  }
}
