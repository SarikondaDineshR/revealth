import { api } from "../../../../../lib/api-client";
import { CompanyCommandCenterView } from "./company-command-center-view";

export default async function CompanyCommandCenterPage({ params }: { params: { workspaceId: string } }) {
  const dashboard = await api.getControlPlaneDashboard(params.workspaceId);
  return <CompanyCommandCenterView dashboard={dashboard} workspaceId={params.workspaceId} />;
}
