import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function getAiModel(modelName = "gemini-3.6-flash") {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  if (lovableApiKey) {
    console.log("Using Lovable AI Gateway provider...");
    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": lovableApiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });
    const targetModel = modelName.startsWith("google/") ? modelName : `google/${modelName}`;
    return provider(targetModel);
  }

  console.log("Using standard Google AI provider...");
  const googleApiKey = process.env["GOOGLE_GENERATIVE_AI_API_KEY"] || process.env["GEMINI_API_KEY"];
  if (!googleApiKey) {
    throw new Error(
      "Missing AI API key. Please configure GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY in your environment or .env.local file."
    );
  }

  const cleanModelName = modelName.replace(/^google\//, "");
  return google(cleanModelName);
}

async function main() {
  console.log("Testing getAiModel('gemini-3.6-flash')...");
  try {
    const res = await generateText({
      model: getAiModel("gemini-3.6-flash"),
      prompt: "Say 'Hello from Gymie!'",
    });
    console.log("SUCCESS:", res.text);
  } catch (err: any) {
    console.error("ERROR:", err.message);
  }
}

main();
