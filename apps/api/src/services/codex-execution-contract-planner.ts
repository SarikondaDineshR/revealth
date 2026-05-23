import crypto from "node:crypto";
import type { CodexExecutionContractItem, GitExecutionPlan, GitExecutionPlanItem } from "@revealth/contracts";

export function assertApprovedGitExecutionPlan(input: { artifactType: string; status: string }) {
  if (input.artifactType !== "git_execution_plan") {
    throw Object.assign(new Error("Codex execution contracts can only be generated from git_execution_plan artifacts."), {
      statusCode: 409,
      code: "INVALID_CODEX_EXECUTION_CONTRACT_SOURCE",
    });
  }

  if (input.status !== "approved") {
    throw Object.assign(new Error("Git execution plan must be approved before generating a Codex execution contract."), {
      statusCode: 409,
      code: "GIT_EXECUTION_PLAN_NOT_APPROVED",
    });
  }
}

export function inferAllowedPaths(plan: GitExecutionPlanItem) {
  const body = `${plan.prBodyDraft}\n${plan.prTitle}`.toLowerCase();
  const paths = new Set<string>();

  if (body.includes("api") || body.includes("service") || body.includes("route")) {
    paths.add("apps/api/src/");
  }
  if (body.includes("workflow") || body.includes("temporal") || body.includes("worker")) {
    paths.add("apps/workers/src/");
  }
  if (body.includes("schema") || body.includes("database") || body.includes("prisma") || body.includes("persist")) {
    paths.add("packages/database/prisma/");
    paths.add("packages/database/src/");
  }
  if (body.includes("contract") || body.includes("validation") || body.includes("zod")) {
    paths.add("packages/contracts/src/");
  }
  if (body.includes("frontend") || body.includes("ui") || body.includes("screen")) {
    paths.add("apps/web/src/");
  }
  if (paths.size === 0) {
    paths.add("apps/api/src/");
    paths.add("packages/contracts/src/");
  }

  return [...paths];
}

export function buildCodexExecutionContractItem(input: {
  plan: GitExecutionPlanItem;
  sourceGitExecutionPlanId: string;
  maxExecutionScope: string;
}): CodexExecutionContractItem {
  return {
    sourceGitExecutionPlanId: input.sourceGitExecutionPlanId,
    sourceCodexPacketId: input.plan.sourceCodexPacketId,
    sourceTaskId: input.plan.sourceTaskId,
    exactAllowedFilesOrDirectories: inferAllowedPaths(input.plan),
    forbiddenFiles: [
      ".env",
      ".env.*",
      "**/*secret*",
      "**/*credential*",
      "node_modules/",
      ".git/",
      "packages/database/prisma/migrations/**/migration_lock.toml",
    ],
    allowedCommands: [
      "corepack pnpm --filter @revealth/contracts typecheck",
      "corepack pnpm --filter @revealth/api typecheck",
      "corepack pnpm --filter @revealth/workers typecheck",
      "corepack pnpm --filter @revealth/api test",
      "corepack pnpm --filter @revealth/workers test",
      "corepack pnpm build",
    ],
    forbiddenCommands: [
      "git push",
      "git reset --hard",
      "git clean",
      "docker compose down -v",
      "Remove-Item -Recurse",
      "rm -rf",
      "npm publish",
      "vercel deploy",
      "aws *",
    ],
    requiredTests: input.plan.requiredTests,
    maxExecutionScope: input.maxExecutionScope,
    branchName: input.plan.branchName,
    rollbackInstructions: input.plan.rollbackPlan,
    prRequirements: {
      title: input.plan.prTitle,
      bodyMustInclude: ["Objective", "Acceptance Criteria", "Tests Required", "Rollback", "Security Notes"],
      requiredReviewers: input.plan.requiredReviewers,
      mergeGateChecklist: input.plan.mergeGateChecklist,
    },
    humanApprovalRequirements: [
      "Human owner must approve this Codex execution contract before any code execution is allowed.",
      "Human owner must approve branch creation before a branch is created.",
      "Human owner must approve pull request creation before any PR is opened.",
      "Human owner must approve merge separately after tests and review.",
    ],
    secretHandlingRules: [
      "Do not read, print, modify, commit, or copy secrets from .env or credential files.",
      "Do not include API keys, tokens, private keys, cookies, or credentials in artifacts, logs, prompts, commits, or PRs.",
      "Use only documented environment variable names when configuration is required.",
    ],
    securityConstraints: [
      "No external side effects beyond approved local validation commands.",
      "No production deployment, billing, sales, or customer-facing automation.",
      "No dependency installation or package upgrades unless explicitly included in a future approved contract.",
      "Preserve auditability and schema validation for any future implementation work.",
    ],
  };
}

export function buildCodexExecutionContract(input: {
  plan: GitExecutionPlan;
  sourceGitExecutionPlanArtifactId: string;
  maxExecutionScope: string;
}) {
  return {
    schemaVersion: "revealth.codex_execution_contract.v1" as const,
    codexExecutionContractId: crypto.randomUUID(),
    sourceGitExecutionPlanArtifactId: input.sourceGitExecutionPlanArtifactId,
    contracts: input.plan.plans.map((plan) =>
      buildCodexExecutionContractItem({
        plan,
        sourceGitExecutionPlanId: input.plan.gitExecutionPlanId,
        maxExecutionScope: input.maxExecutionScope,
      }),
    ),
    approvalRequired: true as const,
    codeExecutionAllowed: false as const,
    branchCreationAllowed: false as const,
    pullRequestCreationAllowed: false as const,
    sourceIds: [input.sourceGitExecutionPlanArtifactId],
  };
}
