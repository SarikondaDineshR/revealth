import { Connection, Client } from "@temporalio/client";
import type { ApiEnv } from "../config/env.js";

export async function createTemporalClient(env: ApiEnv): Promise<Client> {
  const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS });
  return new Client({ connection, namespace: env.TEMPORAL_NAMESPACE });
}

