import { NativeConnection, Worker } from "@temporalio/worker";
import fs from "node:fs/promises";
import * as agentActivities from "./activities/agent.activities.js";
import * as artifactActivities from "./activities/artifact.activities.js";
import * as workflowActivities from "./activities/workflow.activities.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();

const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS });

const worker = await Worker.create({
  connection,
  namespace: env.TEMPORAL_NAMESPACE,
  taskQueue: env.TEMPORAL_TASK_QUEUE,
  workflowsPath: new URL("./workflows/index.js", import.meta.url).pathname,
  activities: {
    ...agentActivities,
    ...artifactActivities,
    ...workflowActivities,
  },
});

const healthFile = "/tmp/revealth-worker-ready";
await fs.writeFile(healthFile, `${new Date().toISOString()}\n`, "utf8");
setInterval(() => {
  void fs.writeFile(healthFile, `${new Date().toISOString()}\n`, "utf8");
}, 10_000).unref();

await worker.run();
