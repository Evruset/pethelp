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
  muted: "#53627B",
  blue: "#0D55D8",
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
  backLabel,
  v50Exact = false,
  children,
}: PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
  onBack?(): void;
  backLabel?: string;
  v50Exact?: boolean;
}>) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= t.layout.ownerV50DesktopMinWidth;
  const mobile = width <= t.layout.ownerV50MobileMaxWidth;
  return (
    <OwnerAppFrame wide>
      {v50Exact ? (
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, overflow: "hidden", backgroundColor: "#F5F9FF" }}>
          <View style={{ position: "absolute", width: 760, height: 760, borderRadius: 380, top: -470, left: -190, backgroundColor: "#DDEBFF", opacity: 0.9 }} />
          <View style={{ position: "absolute", width: 650, height: 650, borderRadius: 325, top: 10, right: -360, backgroundColor: "#EEE8FF", opacity: 0.72 }} />
        </View>
      ) : null}
      <ScrollView
        style={{ flex: 1, backgroundColor: v50Exact ? "transparent" : decisionColors.canvas }}
        contentContainerStyle={{
          width: "100%",
          maxWidth: 1440,
          alignSelf: "center",
          paddingHorizontal: v50Exact ? (desktop ? 30 : mobile ? 14 : 30) : desktop ? t.ownerHome.pageGutterDesktop : mobile ? t.ownerHome.pageGutterMobile : t.ownerHome.pageGutterTablet,
          paddingTop: v50Exact ? (desktop ? 30 : 14) : desktop ? 14 : 10,
          paddingBottom: desktop ? 48 : 92,
          gap: v50Exact ? (desktop ? 18 : 14) : desktop ? 12 : 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {onBack ? <BackAction onPress={onBack} label={backLabel} /> : null}
        <View style={{ gap: 4, marginBottom: desktop ? 2 : 4 }}>
          <Text
            style={{
              ...t.typography.caption,
              color: decisionColors.blue,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 0.7,
            }}
          >
            {eyebrow}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: v50Exact ? (desktop ? 46 : 30) : desktop ? 30 : 27,
              lineHeight: v50Exact ? (desktop ? 51 : 35) : desktop ? 34 : 32,
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
              maxWidth: 720,
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

export function DecisionPanel({ children, v50Exact = false }: PropsWithChildren<{v50Exact?:boolean}>) {
  return (
    <View
      style={{
        minWidth: 0,
        gap: v50Exact ? 14 : 10,
        padding: v50Exact ? 22 : 14,
        borderWidth: 1,
        borderColor: decisionColors.border,
        borderRadius: v50Exact ? 24 : 16,
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
    <View style={{ gap: 3 }}>
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
          fontSize: 18,
          lineHeight: 22,
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
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
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
        minHeight: 28,
        justifyContent: "center",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor:
          tone === "positive"
            ? decisionColors.greenSoft
            : decisionColors.blueSoft,
      }}
    >
      <Text
        style={{
          ...t.typography.caption,
          fontSize: 11,
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
  equal = false,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  equal?: boolean;
}) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= t.layout.ownerV50WideMinWidth;
  return (
    <View
      style={{
        flexDirection: desktop ? "row" : "column",
        alignItems: "flex-start",
        gap: desktop ? 12 : 10,
      }}
    >
      <View
        style={{
          flex: desktop ? (equal ? 1 : 1.25) : undefined,
          width: desktop ? undefined : "100%",
          minWidth: 0,
        }}
      >
        {primary}
      </View>
      <View
        style={{
          flex: desktop ? (equal ? 1 : 0.75) : undefined,
          width: desktop ? undefined : "100%",
          minWidth: 0,
        }}
      >
        {secondary}
      </View>
    </View>
  );
}
