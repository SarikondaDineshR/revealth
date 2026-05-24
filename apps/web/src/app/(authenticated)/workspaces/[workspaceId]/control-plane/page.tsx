import { api } from "../../../../../lib/api-client";
import { ControlPlaneDashboardView } from "./control-plane-view";

export default async function ControlPlanePage({ params }: { params: { workspaceId: string } }) {
  const dashboard = await api.getControlPlaneDashboard(params.workspaceId);
  return <ControlPlaneDashboardView dashboard={dashboard} workspaceId={params.workspaceId} />;
}
