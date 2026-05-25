# Recordable Demo Runbook

Use this path for screenshots, videos, founder walkthroughs, and investor demos.

## Startup

```powershell
docker compose up -d
corepack pnpm db:deploy
corepack pnpm db:seed
corepack pnpm demo:recordable
```

Then open:

```text
http://localhost:3000/workspaces/22222222-2222-4222-8222-222222222222/company
```

## What The Command Does

`corepack pnpm demo:recordable` safely resets only the fixed recordable workspace:

```text
22222222-2222-4222-8222-222222222222
```

It seeds one deterministic showcase scenario:

```text
Real Estate CRM Platform
Client: Maya Chen, Harbor & Pine Realty
```

The seeded scene includes:

- Approved project brief, SDLC plan, task batch, workforce plan, and client script.
- Pending GitHub issue batch approval.
- Pending communication draft approval.
- Active AI team assignments.
- Work dispatches, handoffs, blockers, client-visible updates, and audit events.
- A clear next safe step for the owner.

## Recommended Screen Sequence

1. Open the AI Company Command Center.
2. Start with the Project Journey tracker.
3. Show the AI Team and explain who is doing what.
4. Show Current Work and the active dispatch state.
5. Show Team Discussion to highlight handoffs and blockers.
6. Show Client Updates to prove communication is client-safe and simulated.
7. End on Approvals Needed and Next Safe Step.

## Talking Points

- Revealth behaves like a governed AI software company, not a chatbot.
- The AI team can plan, divide work, surface risks, and prepare client-safe updates.
- Approvals are visible and required before sensitive next steps.
- External communication, live execution, branches, PRs, calls, and meetings remain blocked.
- The demo is deterministic, so recordings and screenshots can be reproduced.

## Safety Notes

- The command does not send email or SMS.
- The command does not call anyone or join meetings.
- The command does not execute code, create branches, or open PRs.
- The command does not reset user-created workspaces.
