import { describe, expect, it } from "vitest";
import { resolveChainedWorkflow } from "./workflow-chain-service.js";

describe("resolveChainedWorkflow", () => {
  it("chains approved project briefs into SDLC planning", () => {
    expect(resolveChainedWorkflow("project_brief")).toMatchObject({
      workflowType: "sdlc_plan",
      temporalWorkflowName: "sdlcPlanWorkflow",
      inputArtifactField: "projectBriefArtifactId",
    });
  });

  it("chains approved SDLC plans into task generation", () => {
    expect(resolveChainedWorkflow("sdlc_plan")).toMatchObject({
      workflowType: "task_generation",
      temporalWorkflowName: "taskGenerationWorkflow",
      inputArtifactField: "sdlcPlanArtifactId",
    });
  });

  it("chains approved task batches into GitHub issue drafts without GitHub writes", () => {
    expect(resolveChainedWorkflow("task_batch")).toMatchObject({
      workflowType: "github_issue_drafts",
      temporalWorkflowName: "githubIssueDraftWorkflow",
      inputArtifactField: "taskBatchArtifactId",
    });
  });

  it("does not chain unsupported artifact types", () => {
    expect(resolveChainedWorkflow("github_issue_batch")).toBeNull();
  });
});
