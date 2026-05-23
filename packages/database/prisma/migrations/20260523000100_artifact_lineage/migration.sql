ALTER TABLE artifacts
  ADD COLUMN parent_artifact_id UUID,
  ADD COLUMN source_workflow_run_id UUID,
  ADD COLUMN source_approval_id UUID,
  ADD COLUMN generated_by_agent TEXT,
  ADD COLUMN prompt_version TEXT,
  ADD COLUMN model_provider TEXT,
  ADD COLUMN model_name TEXT;

ALTER TABLE artifacts
  ADD CONSTRAINT artifacts_source_workflow_run_id_fkey
  FOREIGN KEY (source_workflow_run_id) REFERENCES workflow_runs(id);

ALTER TABLE artifacts
  ADD CONSTRAINT artifacts_source_approval_id_fkey
  FOREIGN KEY (source_approval_id) REFERENCES approvals(id);

CREATE INDEX idx_artifacts_parent_artifact_id ON artifacts(parent_artifact_id);
CREATE INDEX idx_artifacts_source_workflow_run_id ON artifacts(source_workflow_run_id);
CREATE INDEX idx_artifacts_source_approval_id ON artifacts(source_approval_id);
