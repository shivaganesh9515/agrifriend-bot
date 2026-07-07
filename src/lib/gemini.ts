import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { config } from "../config";

let genAI: GoogleGenerativeAI;
let model: GenerativeModel;

export function initGemini(): void {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not set in .env");
  }
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

export async function generateTextResponse(
  userMessage: string,
  context?: string
): Promise<string> {
  const prompt = context
    ? `${config.systemPrompt}\n\n---\nRelevant memory about this user:\n${context}\n\n---\nUser message: ${userMessage}`
    : `${config.systemPrompt}\n\nUser message: ${userMessage}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function analyzeImage(
  imageBytes: Uint8Array,
  mimeType: string,
  userMessage?: string,
  context?: string
): Promise<string> {
  const imagePart = {
    inlineData: {
      data: Buffer.from(imageBytes).toString("base64"),
      mimeType,
    },
  };

  const textPart = userMessage || "Analyze this plant/crop image. Identify any issues, diseases, or if it looks healthy. Be concise and practical.";

  const prompt = context
    ? `${config.systemPrompt}\n\n---\nRelevant memory about this user:\n${context}\n\n---`
    : config.systemPrompt;

  const result = await model.generateContent([
    prompt,
    imagePart,
    { text: textPart },
  ]);

  return result.response.text();
}
