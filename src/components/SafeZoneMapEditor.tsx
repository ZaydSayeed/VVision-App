import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";
import { saveGeofence } from "../api/client";

// Backend accepts a circular geofence: center lat/lng + radiusMeters (50–50000).
type LatLng = { lat: number; lng: number };

export interface Geofence {
  lat: number;
  lng: number;
  radiusMeters: number;
  name: string;
}

interface Props {
  visible: boolean;
  patientId: string;
  patientName: string;
  initial: Geofence | null;
  onClose: () => void;
  onSaved: (g: Geofence) => void;
}

const EARTH_R = 6378137; // metres
const MIN_RADIUS = 50;
const MAX_RADIUS = 5000; // capped well under the backend's 50000 for a sane home zone
const DEFAULT_RADIUS = 500;
// Fallback map centre if we can't read the caregiver's location (Dallas, TX).
const FALLBACK: LatLng = { lat: 32.7767, lng: -96.797 };

const RADIUS_PRESETS = [
  { label: "Small", meters: 150 },
  { label: "Medium", meters: 500 },
  { label: "Large", meters: 1500 },
];

// Point at `distance` metres from `origin` along `bearing` degrees.
function destination(origin: LatLng, distance: number, bearing: number): LatLng {
  const d = distance / EARTH_R;
  const brng = (bearing * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

// Great-circle distance in metres between two points.
function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function clampRadius(m: number): number {
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.round(m)));
}

// Zoom so the whole circle comfortably fits on screen.
function regionForRadius(center: LatLng, radiusMeters: number) {
  const latDelta = (radiusMeters * 3) / 111320;
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: Math.max(latDelta, 0.005),
    longitudeDelta: Math.max(latDelta, 0.005),
  };
}

export function SafeZoneMapEditor({
  visible,
  patientId,
  patientName,
  initial,
  onClose,
  onSaved,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  const [center, setCenter] = useState<LatLng>(FALLBACK);
  const [radiusMeters, setRadiusMeters] = useState<number>(DEFAULT_RADIUS);
  const [name, setName] = useState<string>("Home");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  // Marker that sits on the circle's edge — dragging it resizes the zone.
  const edge = useMemo(() => destination(center, radiusMeters, 90), [center, radiusMeters]);

  // Seed the editor each time it opens.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function init() {
      setReady(false);
      if (initial) {
        setCenter({ lat: initial.lat, lng: initial.lng });
        setRadiusMeters(clampRadius(initial.radiusMeters ?? DEFAULT_RADIUS));
        setName(initial.name || "Home");
        setReady(true);
        return;
      }
      // No zone yet — centre the map on the caregiver's current location as a starting guess.
      setName("Home");
      setRadiusMeters(DEFAULT_RADIUS);
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({});
          if (!cancelled) {
            setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        }
      } catch {
        // fall back to default centre
      } finally {
        if (!cancelled) {
          setLocating(false);
          setReady(true);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [visible, initial]);

  // Keep the camera framed on the zone whenever it becomes ready.
  useEffect(() => {
    if (ready && mapRef.current) {
      mapRef.current.animateToRegion(regionForRadius(center, radiusMeters), 400);
    }
  }, [ready]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const data = await saveGeofence(patientId, {
        lat: center.lat,
        lng: center.lng,
        radiusMeters: clampRadius(radiusMeters),
        name: (name || "Home").trim().slice(0, 100),
      });
      onSaved({
        lat: data.lat,
        lng: data.lng,
        radiusMeters: data.radiusMeters,
        name: data.name,
      });
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Safe Zone",
        err?.message?.trim()
          ? `Could not save the safe zone: ${err.message}`
          : "Could not save the safe zone. The server may be waking up — please try again in a moment."
      );
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        map: { flex: 1 },
        header: {
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 4,
        },
        headerTitle: {
          flex: 1,
          fontSize: 16,
          ...fonts.medium,
          color: colors.text,
          backgroundColor: colors.bg,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
          elevation: 4,
        },
        hintPill: {
          position: "absolute",
          alignSelf: "center",
          backgroundColor: "rgba(0,0,0,0.7)",
          borderRadius: radius.pill,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
        },
        hintText: { fontSize: 13, ...fonts.regular, color: "#fff" },
        panel: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: spacing.xl,
          gap: spacing.md,
        },
        panelLabel: {
          fontSize: 11,
          ...fonts.medium,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: colors.muted,
        },
        nameInput: {
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          fontSize: 16,
          ...fonts.regular,
          color: colors.text,
          backgroundColor: colors.bg,
        },
        presetRow: { flexDirection: "row", gap: spacing.sm },
        presetChip: {
          flex: 1,
          borderRadius: radius.pill,
          paddingVertical: spacing.sm,
          alignItems: "center",
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        presetChipActive: {
          backgroundColor: colors.violet50,
          borderColor: colors.violet,
        },
        presetText: { fontSize: 13, ...fonts.medium, color: colors.muted },
        presetTextActive: { color: colors.violet },
        radiusReadout: { fontSize: 13, ...fonts.regular, color: colors.muted },
        saveBtn: {
          backgroundColor: colors.violet,
          borderRadius: radius.pill,
          paddingVertical: spacing.md + 2,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: spacing.xs,
          marginTop: spacing.xs,
        },
        saveBtnText: { fontSize: 16, ...fonts.medium, color: "#fff" },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        },
      }),
    [colors]
  );

  const activePreset = RADIUS_PRESETS.find((p) => p.meters === radiusMeters)?.meters;
  const radiusLabel =
    radiusMeters >= 1000
      ? `${(radiusMeters / 1000).toFixed(radiusMeters % 1000 === 0 ? 0 : 1)} km`
      : `${radiusMeters} m`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={regionForRadius(center, radiusMeters)}
          onPress={(e: any) => {
            // Tap anywhere to drop the home pin there.
            const c = e.nativeEvent.coordinate;
            setCenter({ lat: c.latitude, lng: c.longitude });
          }}
        >
          <Circle
            center={{ latitude: center.lat, longitude: center.lng }}
            radius={radiusMeters}
            strokeColor={colors.violet}
            strokeWidth={2}
            fillColor="rgba(123,92,231,0.18)"
          />
          {/* Home pin — drag to move the whole zone. */}
          <Marker
            coordinate={{ latitude: center.lat, longitude: center.lng }}
            draggable
            onDragEnd={(e: any) => {
              const c = e.nativeEvent.coordinate;
              setCenter({ lat: c.latitude, lng: c.longitude });
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: colors.violet,
                borderWidth: 3,
                borderColor: "#fff",
              }}
            />
          </Marker>
          {/* Edge handle — drag to grow or shrink the zone. */}
          <Marker
            coordinate={{ latitude: edge.lat, longitude: edge.lng }}
            draggable
            onDrag={(e: any) => {
              const c = e.nativeEvent.coordinate;
              setRadiusMeters(
                clampRadius(distanceMeters(center, { lat: c.latitude, lng: c.longitude }))
              );
            }}
            onDragEnd={(e: any) => {
              const c = e.nativeEvent.coordinate;
              setRadiusMeters(
                clampRadius(distanceMeters(center, { lat: c.latitude, lng: c.longitude }))
              );
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: "#fff",
                borderWidth: 3,
                borderColor: colors.violet,
              }}
            />
          </Marker>
        </MapView>

        <View style={[styles.header, { top: insets.top + spacing.sm }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {patientName}'s Safe Zone
          </Text>
        </View>

        <View style={[styles.hintPill, { top: insets.top + spacing.sm + 52 }]}>
          <Ionicons name="hand-left-outline" size={15} color="#fff" />
          <Text style={styles.hintText}>Drag the pin to the home · drag the ring to resize</Text>
        </View>

        <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View>
            <Text style={styles.panelLabel}>Zone name</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Home"
              placeholderTextColor={colors.muted}
              maxLength={100}
            />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.panelLabel}>Zone size</Text>
            <Text style={styles.radiusReadout}>{radiusLabel} across from center</Text>
          </View>
          <View style={styles.presetRow}>
            {RADIUS_PRESETS.map((p) => {
              const active = activePreset === p.meters;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  onPress={() => setRadiusMeters(p.meters)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save Safe Zone</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {(!ready || locating) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.violet} />
            <Text style={[styles.radiusReadout, { marginTop: spacing.md }]}>
              {locating ? "Finding your location…" : "Loading map…"}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
