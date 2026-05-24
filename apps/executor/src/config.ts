import { z } from "zod";

const envSchema = z.object({
  EXECUTOR_HOST: z.string().default("0.0.0.0"),
  EXECUTOR_PORT: z.coerce.number().int().positive().default(4100),
  EXECUTOR_REPOSITORY_PATH: z.string().min(1).default("/workspace"),
  LOG_LEVEL: z.string().default("info"),
});

export type ExecutorEnv = z.infer<typeof envSchema>;

export function loadEnv(): ExecutorEnv {
  return envSchema.parse(process.env);
}
