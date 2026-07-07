import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import path from "path";
import fs from "fs";

interface VectorEntry {
  text: string;
  userId: string;
  groupId: string;
  timestamp: string;
  embedding: number[];
}

let entries: VectorEntry[] = [];
let embeddingModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
let metaPath: string;
let binPath: string;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function initMemory(): void {
  if (!config.geminiApiKey) return;

  const dir = path.dirname(config.vectorPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  metaPath = config.vectorPath + "_meta.json";
  binPath = config.vectorPath + "_entries.json";

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

  if (fs.existsSync(binPath)) {
    try {
      entries = JSON.parse(fs.readFileSync(binPath, "utf-8"));
    } catch {
      entries = [];
    }
  }
}

function saveEntries(): void {
  fs.writeFileSync(binPath, JSON.stringify(entries, null, 2));
}

async function getEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

export async function storeMemory(
  text: string,
  userId: string,
  groupId: string
): Promise<void> {
  const embedding = await getEmbedding(text);

  entries.push({
    text,
    userId,
    groupId,
    timestamp: new Date().toISOString(),
    embedding,
  });

  saveEntries();
}

export async function queryMemory(
  query: string,
  userId: string,
  limit = 3
): Promise<string[]> {
  if (entries.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);

  const scored = entries
    .map((entry, idx) => ({
      idx,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  const relevant = scored
    .filter((s) => entries[s.idx].userId === userId)
    .slice(0, limit);

  return relevant.map((r) => entries[r.idx].text);
}
