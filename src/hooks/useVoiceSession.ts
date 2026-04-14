import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";
import { authFetch } from "../api/authFetch";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "ended" | "error";

export function useVoiceSession(patientId: string | undefined) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const start = useCallback(async () => {
    if (!patientId) return;
    setState("connecting"); setTranscript("");
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const session = await authFetch(`/api/live/session/${patientId}`, { method: "POST" }).then(r => r.json());
    const ws = new WebSocket(session.wsUrl);
    wsRef.current = ws;
    ws.onopen = async () => {
      setState("listening");
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ios: { extension: ".wav", audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        android: { extension: ".wav", outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000 },
        web: {},
        isMeteringEnabled: false,
      });
      // NOTE: RN Audio.Recording doesn't stream PCM frames directly; for v1 we record in chunks and send at end-of-turn.
      await rec.startAsync();
      recordingRef.current = rec;
    };
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.serverContent?.outputTranscription?.text) {
        setTranscript((t) => t + msg.serverContent.outputTranscription.text);
      }
      if (msg.serverContent?.modelTurn?.parts?.some((p: any) => p.inlineData?.mimeType?.startsWith("audio/"))) {
        setState("speaking");
      }
    };
    ws.onclose = () => setState("ended");
    ws.onerror = () => setState("error");
  }, [patientId]);

  const stop = useCallback(async () => {
    const rec = recordingRef.current;
    if (rec) {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri && wsRef.current?.readyState === WebSocket.OPEN) {
        const fetchBlob = await fetch(uri);
        const buf = await fetchBlob.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        wsRef.current.send(JSON.stringify({ audio_b64: b64, mime: "audio/wav" }));
        wsRef.current.send(JSON.stringify({ end_of_turn: true }));
      }
      recordingRef.current = null;
    }
    // keep ws open to receive final model turn
    setTimeout(() => wsRef.current?.close(), 4000);
  }, []);

  return { state, transcript, start, stop };
}
