import { proto, WASocket, downloadContentFromMessage, DownloadableMessage } from "@whiskeysockets/baileys";
import { config } from "./config";
import { connectWhatsApp } from "./lib/whatsapp";
import { initGemini, generateTextResponse, analyzeImage } from "./lib/gemini";
import { initDB, upsertUser, getUser, saveInteraction, getRecentInteractions } from "./lib/database";
import { initMemory, storeMemory, queryMemory } from "./lib/memory";

const DOMAIN_KEYWORDS = [
  "farming", "garden", "gardening", "plant", "plants", "crop", "crops",
  "soil", "compost", "fertilizer", "pest", "pesticide", "harvest",
  "seed", "seeds", "irrigation", "water", "tomato", "chilli", "chili",
  "leaf", "leaves", "root", "fruit", "vegetable", "herb", "organic",
  "terrace", "balcony", "grow", "growing", "cultivation", "agriculture",
  "horticulture", "botany", "flower", "bloom", "weed", "mulch",
  "nitrogen", "phosphorus", "potassium", "NPK", "ph", "manure",
  "vermicompost", "drip", "spray", "pruning", "grafting",
  "agrifriend", "agri",
];

const FARMING_ONLY_REPLY =
  "I'm focused on our farming community and plant health. Let's keep the discussion grounded in agriculture! 🌱";

function isFarmingRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return DOMAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractTextFromMessage(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  if (!m) return "";

  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;

  return "";
}

async function downloadImage(
  msg: proto.IWebMessageInfo
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const m = msg.message;
  if (!m?.imageMessage) return null;

  try {
    const stream = await downloadContentFromMessage(m as DownloadableMessage, "image");
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return {
      bytes: new Uint8Array(buffer),
      mimeType: m.imageMessage.mimetype || "image/jpeg",
    };
  } catch (err) {
    console.error("Image download failed:", err);
    return null;
  }
}

async function handleMessage(
  socket: WASocket,
  msg: proto.IWebMessageInfo,
  isGroup: boolean,
  senderJid: string,
  groupName?: string
): Promise<void> {
  const text = extractTextFromMessage(msg);
  const hasImage = !!msg.message?.imageMessage;
  const remoteJid = msg.key.remoteJid!;
  const pushName = msg.pushName || "Farmer";

  // Group: only respond if triggered or DM
  if (isGroup) {
    const triggered =
      text.toLowerCase().includes(config.botTrigger.toLowerCase()) ||
      text.includes("@" + config.botTrigger);
    if (!triggered) return;

    // Remove trigger word from message
    const cleanText = text
      .replace(new RegExp(config.botTrigger, "gi"), "")
      .replace(/@\S+/g, "")
      .trim();
    if (!cleanText && !hasImage) {
      await socket.sendMessage(remoteJid, {
        text: `🌱 Hi ${pushName}! Ask me anything about farming, gardening, or plant health!`,
      });
      return;
    }
  }

  // Domain guardrail — skip for images (let Gemini analyze them)
  if (!hasImage) {
    const messageText = text || "";
    if (messageText && !isFarmingRelated(messageText)) {
      await socket.sendMessage(remoteJid, { text: FARMING_ONLY_REPLY });
      return;
    }
  }

  // Update user record
  upsertUser(senderJid, pushName, remoteJid);

  // Get user context from memory
  const contextParts: string[] = [];

  // SQLite recent interactions
  const recent = getRecentInteractions(senderJid, 3);
  if (recent.length > 0) {
    const history = recent
      .map((r) => `User said: "${r.message}" | You replied: "${r.response}"`)
      .join("\n");
    contextParts.push(`Recent conversation history:\n${history}`);
  }

  // Vector memory
  try {
    const memoryResults = await queryMemory(text || "plant photo", senderJid);
    if (memoryResults.length > 0) {
      contextParts.push(`Past memories about this user:\n${memoryResults.join("\n")}`);
    }
  } catch {
    // Memory not critical, continue
  }

  // User profile
  const user = getUser(senderJid);
  if (user) {
    const profile = [];
    if (user.plants) profile.push(`Growing: ${user.plants}`);
    if (user.issues) profile.push(`Past issues: ${user.issues}`);
    if (user.location) profile.push(`Location: ${user.location}`);
    if (profile.length > 0) {
      contextParts.push(`User profile:\n${profile.join(", ")}`);
    }
  }

  const context = contextParts.length > 0 ? contextParts.join("\n\n") : undefined;

  let response: string;

  try {
    if (hasImage) {
      const imageData = await downloadImage(msg);
      if (imageData) {
        response = await analyzeImage(
          imageData.bytes,
          imageData.mimeType,
          text || undefined,
          context
        );
      } else {
        response = "I couldn't process the image. Could you try sending it again? 📷";
      }
    } else {
      response = await generateTextResponse(text, context);
    }
  } catch (err) {
    console.error("Gemini error:", err);
    response = "I'm having trouble processing that right now. Please try again in a moment. 🌱";
  }

  // Store interaction
  saveInteraction(senderJid, remoteJid, pushName, text || "[image]", response, hasImage);

  // Store in vector memory for future RAG
  try {
    const memText = `User ${pushName}: ${text || "[shared a plant image]"} | AgriFriend: ${response}`;
    await storeMemory(memText, senderJid, remoteJid);
  } catch {
    // Memory store not critical
  }

  await socket.sendMessage(remoteJid, { text: response });
}

async function main() {
  console.log("🌱 AgriFriend Bot — Starting up...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await initDB();
  console.log("✅ Database initialized");

  initGemini();
  console.log("✅ Gemini AI connected");

  initMemory();
  console.log("✅ RAG memory system ready");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await connectWhatsApp(handleMessage);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
