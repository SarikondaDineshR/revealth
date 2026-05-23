import OpenAI from "openai";
import type { GenerateJsonInput, GenerateJsonResult, ModelProvider } from "./provider.js";
import { parseJsonFromText, validateGeneratedJson } from "./provider.js";

export class OpenAIModelProvider implements ModelProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateJson<T>(input: GenerateJsonInput): Promise<GenerateJsonResult<T>> {
    const response = await this.client.chat.completions.create({
      model: input.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    });

    const rawText = response.choices[0]?.message.content ?? "";
    const json = parseJsonFromText(rawText);
    const data = validateGeneratedJson(input.schema, json) as T;
    return { data, rawText, provider: this.name, model: input.model };
  }
}

