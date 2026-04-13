import { MemoryClient } from "mem0ai";
import { config } from "./config";

let client: MemoryClient | null = null;

export function getMemoryClient(): MemoryClient {
  if (!config.mem0ApiKey) {
    throw new Error("MEM0_API_KEY not configured");
  }
  if (!client) {
    client = new MemoryClient({
      apiKey: config.mem0ApiKey,
      organizationId: config.mem0OrgId || undefined,
      projectId: config.mem0ProjectId || undefined,
    });
  }
  return client;
}

export interface MemoryScope {
  user_id: string;
}

export function buildMemoryScope(patientId: string): MemoryScope {
  if (!patientId) throw new Error("patientId is required");
  return { user_id: patientId };
}

export interface AddMemoryInput {
  patientId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function addMemory(input: AddMemoryInput) {
  const scope = buildMemoryScope(input.patientId);
  const messages = [{ role: "user" as const, content: input.content }];
  return getMemoryClient().add(messages, { ...scope, metadata: input.metadata });
}

export interface SearchMemoryInput {
  patientId: string;
  query: string;
  limit?: number;
}

export async function searchMemory(input: SearchMemoryInput) {
  const scope = buildMemoryScope(input.patientId);
  return getMemoryClient().search(input.query, { ...scope, limit: input.limit ?? 10 });
}
