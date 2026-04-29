import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Daily, { DailyCall, DailyEvent } from "@daily-co/react-native-daily-js";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { API_BASE_URL } from "../../config/api";
import { authHeaders } from "../../api/client";

type ConnectionStatus = "connecting" | "live" | "reconnecting" | "ended";

interface Props {
  patientId: string;
  roomUrl: string;
  token: string;
  onEnd: () => void;
}

export function LiveStreamScreen({ patientId, roomUrl, token, onEnd }: Props) {
  const { colors } = useTheme();
  const callRef = useRef<DailyCall | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [micMuted, setMicMuted] = useState(false);
  const [patientAudioMuted, setPatientAudioMuted] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let call: DailyCall;
    try {
      call = Daily.createCallObject();
    } catch {
      // An instance may already exist — get it
      const existing = Daily.getCallInstance();
      if (existing) {
        call = existing;
      } else {
        setStatus("ended");
        return;
      }
    }
    callRef.current = call;

    const onJoined = () => setStatus("live");
    const onLeft = () => setStatus("ended");
    const onError = () => setStatus("reconnecting");
    const onNetworkQuality = (evt: any) => {
      if (evt?.threshold === "very-low") setStatus("reconnecting");
      else if (status === "reconnecting") setStatus("live");
    };

    call.on("joined-meeting" as DailyEvent, onJoined);
    call.on("left-meeting" as DailyEvent, onLeft);
    call.on("error" as DailyEvent, onError);
    call.on("network-quality-change" as DailyEvent, onNetworkQuality);

    call
      .join({ url: roomUrl, token, startVideoOff: false, startAudioOff: false })
      .catch(() => setStatus("ended"));

    return () => {
      call.off("joined-meeting" as DailyEvent, onJoined);
      call.off("left-meeting" as DailyEvent, onLeft);
      call.off("error" as DailyEvent, onError);
      call.off("network-quality-change" as DailyEvent, onNetworkQuality);
      call.leave().catch(() => {}).finally(() => call.destroy().catch(() => {}));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token]);

  const toggleMic = () => {
    const call = callRef.current;
    if (!call) return;
    const next = !micMuted;
    call.setLocalAudio(!next);
    setMicMuted(next);
  };

  const togglePatientAudio = () => {
    const call = callRef.current;
    if (!call) return;
    const participants = call.participants();
    const next = !patientAudioMuted;
    // Mute all remote participants' audio on the subscriber side
    Object.values(participants).forEach((p: any) => {
      if (!p.local) {
        call.updateParticipant(p.session_id, { setAudio: !next });
      }
    });
    setPatientAudioMuted(next);
  };

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    try {
      await fetch(`${API_BASE_URL}/api/stream/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ patient_id: patientId }),
      });
    } catch {
      // Best-effort — proceed regardless
    }
    const call = callRef.current;
    if (call) {
      await call.leave().catch(() => {});
      await call.destroy().catch(() => {});
    }
    onEnd();
  };

  const statusLabel: Record<ConnectionStatus, string> = {
    connecting: "Connecting…",
    live: "Live",
    reconnecting: "Reconnecting…",
    ended: "Call ended",
  };

  const statusDotColor: Record<ConnectionStatus, string> = {
    connecting: colors.muted,
    live: "#22C55E",
    reconnecting: "#F59E0B",
    ended: colors.muted,
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: "#000",
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
        },
        statusRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        },
        dot: {
          width: 10,
          height: 10,
          borderRadius: 5,
        },
        statusText: {
          color: "#fff",
          fontSize: 16,
          ...fonts.medium,
        },
        bar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.lg,
          paddingBottom: spacing.xl + 8,
          backgroundColor: "rgba(0,0,0,0.7)",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.08)",
        },
        btn: {
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "rgba(255,255,255,0.12)",
        },
        btnActive: {
          backgroundColor: "rgba(255,255,255,0.25)",
        },
        endBtn: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "#EF4444",
        },
        btnLabel: {
          color: "rgba(255,255,255,0.7)",
          fontSize: 11,
          marginTop: 4,
          ...fonts.regular,
        },
        btnWrap: {
          alignItems: "center",
        },
      }),
    [colors]
  );

  return (
    <View style={styles.root}>
      {/* Main area — black canvas; video tracks render via native layer automatically */}
      <View style={styles.center}>
        {status === "connecting" || status === "reconnecting" ? (
          <ActivityIndicator size="large" color={colors.violet} />
        ) : null}
        <View style={styles.statusRow}>
          <View
            style={[styles.dot, { backgroundColor: statusDotColor[status] }]}
          />
          <Text style={styles.statusText}>{statusLabel[status]}</Text>
        </View>
      </View>

      {/* Controls bar */}
      <View style={styles.bar}>
        {/* Mute self */}
        <View style={styles.btnWrap}>
          <TouchableOpacity
            style={[styles.btn, micMuted && styles.btnActive]}
            onPress={toggleMic}
          >
            <Ionicons
              name={micMuted ? "mic-off" : "mic"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <Text style={styles.btnLabel}>{micMuted ? "Unmute" : "Mute"}</Text>
        </View>

        {/* End call */}
        <View style={styles.btnWrap}>
          <TouchableOpacity
            style={[styles.btn, styles.endBtn]}
            onPress={handleEnd}
            disabled={ending}
          >
            <Ionicons name="call" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.btnLabel}>End</Text>
        </View>

        {/* Mute patient audio */}
        <View style={styles.btnWrap}>
          <TouchableOpacity
            style={[styles.btn, patientAudioMuted && styles.btnActive]}
            onPress={togglePatientAudio}
          >
            <Ionicons
              name={patientAudioMuted ? "volume-mute" : "volume-high"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <Text style={styles.btnLabel}>
            {patientAudioMuted ? "Unmute Pt." : "Mute Pt."}
          </Text>
        </View>
      </View>
    </View>
  );
}
