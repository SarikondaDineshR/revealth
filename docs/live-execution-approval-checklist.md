# Live Execution Approval Checklist

Live execution is not enabled in v0.2. This checklist defines the minimum human review required before any future implementation may create branches, modify files, run Codex against a repository, or open pull requests.

## Required Before Enabling

- `CODEX_EXECUTION_MODE=live` remains blocked until explicitly approved.
- A human owner approves the `codex_execution_contract`.
- A human owner approves the `branch_preparation_plan`.
- The executor repository status is clean.
- The executor is not on `main` or `master`.
- The execution run passed preflight.
- The execution run is marked `ready_for_live_execution`.
- The approved contract snapshot matches the execution run snapshot.
- The executor manifest passes integrity verification.

## Contract Review

- Allowed files are exact repository-relative files or directories.
- Allowed files do not use wildcard scopes.
- Forbidden files include `.env`, secret files, and Git internals.
- Allowed commands are explicit and reviewable.
- Commands do not include shell control operators such as `&&`, `;`, pipes, redirects, backticks, or command substitution.
- Required tests are present.
- Rollback instructions are specific.
- Secret-handling rules are explicit.

## Still Prohibited

- Automatic branch creation.
- Automatic pull request creation.
- Production deployment.
- Reading or writing secrets.
- Repository mutation outside the approved contract.
- Customer-facing automation.

## v0.2 Decision

Do not implement live execution in v0.2. The next safe step is to continue improving preflight, inspection, and approval clarity while preserving the v0.1 smoke path.
