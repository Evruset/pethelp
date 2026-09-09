import type { PropsWithChildren, ReactNode } from "react";
import {
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BackAction, OwnerAppFrame } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";

export const decisionColors = Object.freeze({
  canvas: "#EDF5FF",
  surface: "#FFFFFF",
  soft: "#F7FAFF",
  ink: "#182541",
  muted: "#667793",
  blue: "#1767F7",
  blueSoft: "#E8F1FF",
  border: "#C8DAF3",
  green: "#167A55",
  greenSoft: "#E7F6EF",
});
export function ClinicDecisionLayout({
  eyebrow,
  title,
  subtitle,
  onBack,
  children,
}: PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
  onBack(): void;
}>) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  return (
    <OwnerAppFrame wide>
      <ScrollView
        style={{ flex: 1, backgroundColor: decisionColors.canvas }}
        contentContainerStyle={{
          width: "100%",
          maxWidth: 1180,
          alignSelf: "center",
          paddingHorizontal: desktop ? 28 : 14,
          paddingTop: desktop ? 24 : 14,
          paddingBottom: desktop ? 42 : 96,
          gap: desktop ? 20 : 14,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BackAction onPress={onBack} />
        <View style={{ gap: 6 }}>
          <Text
            style={{
              ...t.typography.label,
              color: decisionColors.blue,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            {eyebrow}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: desktop ? 38 : 30,
              lineHeight: desktop ? 44 : 36,
              fontWeight: "800",
              color: decisionColors.ink,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              ...t.typography.secondaryBody,
              color: decisionColors.muted,
              maxWidth: 760,
            }}
          >
            {subtitle}
          </Text>
        </View>
        {children}
      </ScrollView>
    </OwnerAppFrame>
  );
}
export function DecisionPanel({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        minWidth: 0,
        gap: 14,
        padding: 18,
        borderWidth: 1,
        borderColor: decisionColors.border,
        borderRadius: 20,
        backgroundColor: decisionColors.surface,
        ...t.shadow.card,
      }}
    >
      {children}
    </View>
  );
}
export function DecisionHeading({
  kicker,
  title,
  detail,
}: {
  kicker: string;
  title: string;
  detail?: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text
        style={{
          ...t.typography.caption,
          color: decisionColors.blue,
          fontWeight: "700",
        }}
      >
        {kicker}
      </Text>
      <Text
        style={{
          ...t.typography.sectionTitle,
          fontSize: 19,
          lineHeight: 24,
          color: decisionColors.ink,
        }}
      >
        {title}
      </Text>
      {detail ? (
        <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
export function FactRow({ children }: PropsWithChildren) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {children}
    </View>
  );
}
export function Fact({
  children,
  tone = "neutral",
}: PropsWithChildren<{ tone?: "neutral" | "positive" }>) {
  return (
    <View
      style={{
        minHeight: 32,
        justifyContent: "center",
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor:
          tone === "positive"
            ? decisionColors.greenSoft
            : decisionColors.blueSoft,
      }}
    >
      <Text
        style={{
          ...t.typography.caption,
          color:
            tone === "positive" ? decisionColors.green : decisionColors.ink,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function ResponsiveColumns({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  return (
    <View
      style={{
        flexDirection: desktop ? "row" : "column",
        alignItems: "flex-start",
        gap: desktop ? 20 : 14,
      }}
    >
      <View
        style={{
          flex: desktop ? 1.55 : undefined,
          width: desktop ? undefined : "100%",
          minWidth: 0,
        }}
      >
        {primary}
      </View>
      <View
        style={{
          flex: desktop ? 0.85 : undefined,
          width: desktop ? undefined : "100%",
          minWidth: 0,
        }}
      >
        {secondary}
      </View>
    </View>
  );
}
