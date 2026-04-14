import { WebSocketServer, WebSocket } from "ws";
import { Server as HTTPServer, IncomingMessage } from "http";
import { GoogleGenAI, Modality } from "@google/genai";
import { config } from "./config";

export function attachLiveBridge(server: HTTPServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/api/live/ws")) return;
    // TODO: validate auth (Supabase JWT in Sec-WebSocket-Protocol header or query)
    wss.handleUpgrade(req, socket, head, (ws) => bridgeClient(ws, req));
  });
}

async function bridgeClient(client: WebSocket, _req: IncomingMessage) {
  if (!config.geminiApiKey) { client.close(1011, "Gemini not configured"); return; }
  const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const session = await genai.live.connect({
    model: config.geminiLiveModel,
    config: { responseModalities: [Modality.AUDIO, Modality.TEXT] },
    callbacks: {
      onmessage: (msg: any) => client.send(JSON.stringify(msg)),
      onerror: (_e: any) => { client.close(1011, "upstream error"); },
      onclose: () => client.close(1000, "upstream closed"),
    },
  });

  client.on("message", (data: any) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.end_of_turn) session.sendClientContent({ turns: [], turnComplete: true });
      else if (parsed.audio_b64) session.sendRealtimeInput({ media: { data: parsed.audio_b64, mimeType: parsed.mime ?? "audio/pcm;rate=16000" } });
    } catch (e) { console.error("live bridge bad msg:", e); }
  });

  client.on("close", () => session.close());
}
