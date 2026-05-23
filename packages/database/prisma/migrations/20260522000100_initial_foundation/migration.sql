CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  workflow_type TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json JSONB NOT NULL,
  output_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  artifact_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  content_json JSONB NOT NULL,
  source_artifact_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, artifact_type, version)
);

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  artifact_id UUID NOT NULL REFERENCES artifacts(id),
  artifact_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  approver_id UUID REFERENCES users(id),
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id),
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json JSONB NOT NULL,
  output_json JSONB,
  model_provider TEXT,
  model_name TEXT,
  prompt_version TEXT,
  error_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  source_artifact_id UUID NOT NULL REFERENCES artifacts(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  task_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  acceptance_criteria JSONB NOT NULL,
  dependencies UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE github_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  installation_id TEXT NOT NULL,
  repository TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE github_issue_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id),
  repository TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  labels TEXT[] NOT NULL DEFAULT '{}',
  milestone TEXT,
  assignees TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE github_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  task_id UUID NOT NULL,
  repository TEXT NOT NULL,
  github_issue_number INTEGER,
  github_issue_url TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memory_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  memory_type TEXT NOT NULL,
  status TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json JSONB NOT NULL,
  embedding vector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  workflow_run_id UUID REFERENCES workflow_runs(id),
  agent_run_id UUID REFERENCES agent_runs(id),
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  source_artifact_ids UUID[] NOT NULL DEFAULT '{}',
  target_artifact_ids UUID[] NOT NULL DEFAULT '{}',
  input_hash TEXT,
  output_hash TEXT,
  approval_id UUID REFERENCES approvals(id),
  status TEXT NOT NULL,
  error_code TEXT,
  event_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_artifacts_workspace_type ON artifacts(workspace_id, artifact_type);
CREATE INDEX idx_approvals_workspace_status ON approvals(workspace_id, status);
CREATE INDEX idx_workflow_runs_workspace_status ON workflow_runs(workspace_id, status);
CREATE INDEX idx_audit_logs_workspace_created_at ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_tasks_workspace_status ON tasks(workspace_id, status);

