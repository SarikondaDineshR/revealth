import { buildApp } from "./app.js";
import { loadEnv } from "./config.js";

const env = loadEnv();
const app = await buildApp(env);

await app.listen({ host: env.EXECUTOR_HOST, port: env.EXECUTOR_PORT });
