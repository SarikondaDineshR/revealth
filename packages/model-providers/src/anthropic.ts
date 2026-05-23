import Anthropic from "@anthropic-ai/sdk";
import type { GenerateJsonInput, GenerateJsonResult, ModelProvider } from "./provider.js";
import { parseJsonFromText, validateGeneratedJson } from "./provider.js";

export class AnthropicModelProvider implements ModelProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateJson<T>(input: GenerateJsonInput): Promise<GenerateJsonResult<T>> {
    const response = await this.client.messages.create({
      model: input.model,
      max_tokens: 4096,
      temperature: 0.1,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    });

    const rawText = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();
    const json = parseJsonFromText(rawText);
    const data = validateGeneratedJson(input.schema, json) as T;
    return { data, rawText, provider: this.name, model: input.model };
  }
}

