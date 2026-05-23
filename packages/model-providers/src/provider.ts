import type { z } from "zod";

export interface GenerateJsonInput {
  system: string;
  user: string;
  schemaName: string;
  schema: z.ZodType;
  model: string;
}

export interface GenerateJsonResult<T> {
  data: T;
  rawText: string;
  provider: string;
  model: string;
}

export interface ModelProvider {
  readonly name: string;
  generateJson<T>(input: GenerateJsonInput): Promise<GenerateJsonResult<T>>;
}

export function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  throw new Error("Model response did not contain parseable JSON.");
}

export function validateGeneratedJson<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Generated JSON failed schema validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

