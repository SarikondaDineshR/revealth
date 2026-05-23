export interface PromptTemplate {
  id: string;
  system: string;
  user: (input: Record<string, unknown>) => string;
}

const sharedSystem = `You are an agent inside Revealth, an autonomous AI software company operating system.
You must produce only structured JSON matching the provided schema.
Do not invent technical facts.
Mark uncertain information as an assumption or open question.
Do not request or perform external side effects.
Do not bypass approval requirements.
Every task must include acceptance criteria.
Every output must reference source artifact IDs when provided.`;

export const promptRegistry = {
  intake: {
    id: "intake.project_brief.v1",
    system: sharedSystem,
    user: (input) =>
      JSON.stringify({
        objective: "Convert the user's raw software idea into a structured project brief.",
        rawProjectIdea: input.rawProjectIdea,
        requiredSchema: "revealth.project_brief.v1",
      }),
  },
  productPlan: {
    id: "product_strategy.product_plan.v1",
    system: sharedSystem,
    user: (input) =>
      JSON.stringify({
        objective: "Create a v0.1 product plan from the project brief.",
        projectBrief: input.projectBrief,
        requiredSchema: "revealth.product_plan.v1",
      }),
  },
  sdlcPlan: {
    id: "sdlc_orchestration.sdlc_plan.v1",
    system: sharedSystem,
    user: (input) =>
      JSON.stringify({
        objective: "Create a governed SDLC plan from an approved project brief.",
        projectBrief: input.projectBrief,
        requiredSchema: "revealth.sdlc_plan.v1",
      }),
  },
  taskGeneration: {
    id: "task_generation.task_batch.v1",
    system: sharedSystem,
    user: (input) =>
      JSON.stringify({
        objective: "Create a task batch from an approved SDLC plan.",
        sdlcPlan: input.sdlcPlan,
        requiredSchema: "revealth.task_batch.v1",
      }),
  },
} satisfies Record<string, PromptTemplate>;
