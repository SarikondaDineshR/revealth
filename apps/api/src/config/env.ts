import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url().default("http://localhost:4000"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().default("info"),
  LOCAL_OWNER_ID: z.string().uuid().default("00000000-0000-4000-8000-000000000001"),
  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
  TEMPORAL_NAMESPACE: z.string().default("default"),
  TEMPORAL_TASK_QUEUE: z.string().default("revealth-v01"),
  GITHUB_TOKEN: z.string().optional().default(""),
  GITHUB_DEFAULT_REPOSITORY: z.string().optional().default(""),
  GITHUB_ISSUE_CREATION_MODE: z.enum(["dry_run", "live"]).default("dry_run"),
  CODEX_EXECUTION_MODE: z.enum(["disabled", "dry_run", "live"]).default("disabled"),
  EXECUTOR_URL: z.string().url().default("http://localhost:4100"),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv(): ApiEnv {
  return envSchema.parse(process.env);
}
