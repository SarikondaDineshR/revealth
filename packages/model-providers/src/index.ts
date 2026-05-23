export type { GenerateJsonInput, GenerateJsonResult, ModelProvider } from "./provider.js";
export { parseJsonFromText, validateGeneratedJson } from "./provider.js";
export { AnthropicModelProvider } from "./anthropic.js";
export { LocalModelProvider } from "./local.js";
export { OpenAIModelProvider } from "./openai.js";

import { AnthropicModelProvider } from "./anthropic.js";
import { LocalModelProvider } from "./local.js";
import { OpenAIModelProvider } from "./openai.js";
import type { ModelProvider } from "./provider.js";

export function createModelProvider(env: NodeJS.ProcessEnv): ModelProvider {
  const provider = env.MODEL_PROVIDER ?? "local";
  if (provider === "openai") {
    if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required when MODEL_PROVIDER=openai.");
    return new OpenAIModelProvider(env.OPENAI_API_KEY);
  }
  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is required when MODEL_PROVIDER=anthropic.");
    }
    return new AnthropicModelProvider(env.ANTHROPIC_API_KEY);
  }
  if (provider === "local") {
    return new LocalModelProvider();
  }
  throw new Error(`Unsupported MODEL_PROVIDER: ${provider}`);
}

