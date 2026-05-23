"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "../../../lib/api-client";

export async function createWorkspaceAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    throw new Error("Workspace name must be at least 2 characters.");
  }
  const workspace = await api.createWorkspace(name);
  revalidatePath("/workspaces");
  redirect(`/workspaces/${workspace.id}`);
}

export async function startIntakeAction(workspaceId: string, formData: FormData) {
  const rawProjectIdea = String(formData.get("rawProjectIdea") ?? "").trim();
  await api.startIntake(workspaceId, rawProjectIdea);
  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function createApprovalAction(workspaceId: string, artifactId: string, artifactVersion: number) {
  await api.createApproval(workspaceId, artifactId, artifactVersion);
  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function decideApprovalAction(
  workspaceId: string,
  approvalId: string,
  status: "approved" | "rejected" | "revision_requested",
) {
  await api.decideApproval(workspaceId, approvalId, status, `Decision submitted from founder console: ${status}`);
  revalidatePath(`/workspaces/${workspaceId}`);
}

