import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscription } from "../../hooks/useSubscription";
import { useTheme } from "../../context/ThemeContext";
import { fonts, gradients, radius, spacing, typography } from "../../config/theme";

// ─── Plan Card ────────────────────────────────────────────────────────────────

interface PlanCardProps {
  title: string;
  price: string;
  seats: string;
  features: string[];
  cta: string;
  disabled: boolean;
  onPress: () => void;
  highlighted?: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}

function PlanCard({
  title,
  price,
  seats,
  features,
  cta,
  disabled,
  onPress,
  highlighted = false,
  colors,
}: PlanCardProps) {
  const cardStyles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: radius.xl,
          padding: spacing.xl,
          marginBottom: spacing.lg,
          shadowColor: colors.violet,
          shadowOffset: { width: 0, height: highlighted ? 8 : 3 },
          shadowOpacity: highlighted ? 0.28 : 0.07,
          shadowRadius: highlighted ? 20 : 12,
          elevation: highlighted ? 8 : 3,
        },
        title: {
          ...typography.subtitleStyle,
          ...fonts.medium,
          color: highlighted ? "#FFFFFF" : colors.text,
        },
        badge: {
          alignSelf: "flex-start",
          backgroundColor: highlighted ? "rgba(255,255,255,0.2)" : colors.violet50,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          marginTop: spacing.xs,
          marginBottom: spacing.md,
        },
        badgeText: {
          fontSize: typography.caption,
          ...fonts.medium,
          letterSpacing: 0.8,
          color: highlighted ? "rgba(255,255,255,0.9)" : colors.violet,
          textTransform: "uppercase",
        },
        price: {
          fontSize: 36,
          lineHeight: 42,
          ...fonts.medium,
          color: highlighted ? "#FFFFFF" : colors.text,
          marginTop: spacing.xs,
        },
        seats: {
          ...typography.smallStyle,
          ...fonts.regular,
          color: highlighted ? "rgba(255,255,255,0.75)" : colors.muted,
          marginTop: spacing.xs,
          marginBottom: spacing.md,
        },
        divider: {
          height: 1,
          backgroundColor: highlighted ? "rgba(255,255,255,0.15)" : colors.border,
          marginVertical: spacing.md,
        },
        featureRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.sm,
          gap: spacing.sm,
        },
        featureDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: highlighted ? "rgba(255,255,255,0.6)" : colors.violet300,
        },
        featureText: {
          ...typography.bodyStyle,
          ...fonts.regular,
          color: highlighted ? "rgba(255,255,255,0.9)" : colors.text,
          flex: 1,
        },
        ctaBtn: {
          borderRadius: radius.pill,
          paddingVertical: 14,
          alignItems: "center",
          marginTop: spacing.lg,
          backgroundColor: highlighted ? "#FFFFFF" : colors.violet,
          opacity: disabled ? 0.45 : 1,
          shadowColor: highlighted ? "#FFFFFF" : colors.violet,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: disabled ? 0 : 0.3,
          shadowRadius: 10,
          elevation: disabled ? 0 : 5,
        },
        ctaText: {
          ...fonts.medium,
          fontSize: typography.body,
          color: highlighted ? colors.violet : "#FFFFFF",
        },
      }),
    [colors, highlighted, disabled]
  );

  const cardContent = (
    <>
      <Text style={cardStyles.title}>{title}</Text>
      <View style={cardStyles.badge}>
        <Text style={cardStyles.badgeText}>
          {highlighted ? "Most popular" : "Great value"}
        </Text>
      </View>
      <Text style={cardStyles.price}>{price}</Text>
      <Text style={cardStyles.seats}>{seats}</Text>
      <View style={cardStyles.divider} />
      {features.map((f) => (
        <View key={f} style={cardStyles.featureRow}>
          <View style={cardStyles.featureDot} />
          <Text style={cardStyles.featureText}>{f}</Text>
        </View>
      ))}
      <Pressable
        style={cardStyles.ctaBtn}
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={cta}
        accessibilityState={{ disabled }}
      >
        <Text style={cardStyles.ctaText}>{cta}</Text>
      </Pressable>
    </>
  );

  if (highlighted) {
    return (
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cardStyles.card}
      >
        {cardContent}
      </LinearGradient>
    );
  }

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.surface }]}>
      {cardContent}
    </View>
  );
}

// ─── Paywall Screen ───────────────────────────────────────────────────────────

export default function PaywallScreen({ navigation }: any) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { tier } = useSubscription();
  const { colors } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        setPackages(offerings.current?.availablePackages ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      navigation.replace("CaregiverHome");
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert("Purchase failed", e.message ?? "Please try again.");
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    try {
      await Purchases.restorePurchases();
      Alert.alert("Restored", "Your purchases have been restored.");
    } catch (e: any) {
      Alert.alert("Restore failed", e.message ?? "Please try again.");
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        content: {
          paddingHorizontal: spacing.xxl,
          paddingTop: spacing.xl,
          paddingBottom: 48,
        },
        eyebrow: {
          fontSize: typography.caption,
          ...fonts.medium,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: colors.violet,
          marginBottom: spacing.sm,
        },
        heading: {
          fontSize: typography.hero,
          lineHeight: 40,
          ...fonts.medium,
          color: colors.text,
        },
        subheading: {
          ...typography.bodyStyle,
          ...fonts.regular,
          color: colors.muted,
          marginTop: spacing.sm,
          marginBottom: spacing.xxl,
        },
        trialBadge: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: colors.violet50,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          marginBottom: spacing.xxl,
          gap: spacing.xs,
        },
        trialDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.violet,
        },
        trialText: {
          fontSize: typography.small,
          ...fonts.medium,
          color: colors.violet,
        },
        restoreBtn: {
          alignItems: "center",
          paddingVertical: spacing.md,
          marginTop: spacing.sm,
        },
        restoreText: {
          ...typography.bodyStyle,
          ...fonts.regular,
          color: colors.muted,
          textDecorationLine: "underline",
        },
        loaderContainer: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        },
      }),
    [colors]
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={colors.violet} size="large" />
      </View>
    );
  }

  const starter = packages.find((p) => p.product.identifier.includes("starter"));
  const unlimited = packages.find((p) => p.product.identifier.includes("unlimited"));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Upgrade</Text>
      <Text style={styles.heading}>Pick your plan</Text>
      <Text style={styles.subheading}>
        Full access to all caregiver tools. Cancel anytime.
      </Text>

      <View style={styles.trialBadge}>
        <View style={styles.trialDot} />
        <Text style={styles.trialText}>7-day free trial included</Text>
      </View>

      {/* Unlimited first — most prominent */}
      {unlimited && (
        <PlanCard
          title="Unlimited"
          price={unlimited.product.priceString + "/mo"}
          seats="Unlimited siblings + aides"
          features={[
            "Everything in Starter",
            "Unlimited care team seats",
            "Priority support",
          ]}
          highlighted
          cta={tier === "unlimited" ? "Current plan" : "Start free trial"}
          disabled={tier === "unlimited" || purchasing === unlimited.identifier}
          onPress={() => handlePurchase(unlimited)}
          colors={colors}
        />
      )}

      {starter && (
        <PlanCard
          title="Starter"
          price={starter.product.priceString + "/mo"}
          seats="You + 1 sibling"
          features={[
            "Full Living Profile",
            "Voice check-ins",
            "Coach AI assistant",
          ]}
          cta={tier === "starter" ? "Current plan" : "Start free trial"}
          disabled={tier === "starter" || purchasing === starter.identifier}
          onPress={() => handlePurchase(starter)}
          colors={colors}
        />
      )}

      <Pressable style={styles.restoreBtn} onPress={handleRestore}>
        <Text style={styles.restoreText}>Restore purchases</Text>
      </Pressable>
    </ScrollView>
  );
}
