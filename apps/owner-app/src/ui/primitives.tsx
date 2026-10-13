import { useState, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { uiTokens } from "./tokens";

export function Screen({ children, title, onBack, backLabel = "Назад", backDisabled = false, step, footer }: PropsWithChildren<{
  title: string; onBack?(): void; backLabel?: string; backDisabled?: boolean; step?: string; footer?: ReactNode;
}>) {
  return <View style={{ flex: 1, backgroundColor: uiTokens.color.canvas }}>
    {onBack ? <View style={{ paddingHorizontal: 16, paddingTop: 8, borderBottomWidth: 1, borderColor: uiTokens.color.subtleBorder, backgroundColor: '#ffffff' }}>
      <View style={{ alignSelf: 'flex-start' }}><Button label={backLabel} variant="ghost" disabled={backDisabled} onPress={onBack}/></View>
    </View> : null}
    <ScrollView accessibilityLabel={title} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', padding: uiTokens.spacing.xl, gap: uiTokens.spacing.lg, paddingBottom: 32 }}>
      {step ? <Text style={{ color: uiTokens.color.muted, fontSize: 13, fontWeight: '600' }}>{step}</Text> : null}
      <Header title={title}/>{children}
    </ScrollView>
    {footer ? <View style={{ backgroundColor: '#ffffff', borderTopWidth: 1, borderColor: uiTokens.color.subtleBorder, padding: 16, paddingBottom: 24 }}><View style={{ width: '100%', maxWidth: 680, alignSelf: 'center', gap: 8 }}>{footer}</View></View> : null}
  </View>;
}
export function Button({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  variant = "primary",
}: {
  label: string;
  accessibilityLabel?: string;
  onPress(): void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [focused, setFocused] = useState(false);
  const quiet = variant !== "primary";
  const outlined = variant === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 2,
        borderColor: focused ? "#073e32" : outlined ? uiTokens.color.primary : "transparent",
        borderRadius: uiTokens.radius.card,
        backgroundColor: disabled
          ? uiTokens.color.disabled
          : quiet
            ? "transparent"
            : uiTokens.color.primary,
      })}
    >
      <Text
        style={{
          color:
            disabled || !quiet
              ? uiTokens.color.onPrimary
              : uiTokens.color.primary,
          textAlign: "center",
          ...uiTokens.typography.action,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: uiTokens.spacing.xs }}>
      <Text>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        {...props}
        style={{
          borderWidth: 1,
          borderColor: error ? uiTokens.color.critical : uiTokens.color.border,
          borderRadius: uiTokens.radius.control,
          padding: uiTokens.spacing.md,
          minHeight: 48, fontSize: 16, color: uiTokens.color.ink, backgroundColor: "#ffffff",
        }}
      />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}
export function Card({
  children,
  selected = false,
  disabled = false,
  onPress,
  compact = false,
  role = "radio",
}: PropsWithChildren<{
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  compact?: boolean;
  role?: "radio" | "button";
}>) {
  const [focused, setFocused] = useState(false);
  const body = (
    <View
      style={{
        padding: compact ? 12 : 16,
        gap: uiTokens.spacing.sm,
        backgroundColor: "#ffffff",
        opacity: disabled ? 0.55 : 1,
        borderWidth: 2,
        borderColor: focused ? "#073e32" : selected
          ? uiTokens.color.primary
          : uiTokens.color.subtleBorder,
        borderRadius: uiTokens.radius.card,
      }}
    >
      {children}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }) {
  const colors = { info: ['#eaf2ff', '#17437a'], success: ['#e6f2ee', '#126b5b'], warning: ['#f3edff', '#65409c'], danger: ['#feecec', '#a61b1b'], neutral: ['#eef1f4', '#425466'] };
  return <Text accessibilityRole="text" style={{ alignSelf: "flex-start", backgroundColor: colors[tone][0], color: colors[tone][1], borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, fontWeight: "600" }}>{label}</Text>;
}
export function Header({ title }: { title: string }) {
  return (
    <Text accessibilityRole="header" style={{...uiTokens.typography.heading,color:uiTokens.color.ink,letterSpacing:-0.4}}>
      {title}
    </Text>
  );
}
export function ListRow({
  title,
  subtitle,
  selected = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress(): void;
}) {
  return (
    <Card selected={selected} onPress={onPress}>
      <Text style={{ fontWeight: "600" }}>{title}</Text>
      {subtitle ? <Text>{subtitle}</Text> : null}
    </Card>
  );
}
export function NotificationBadge({ count }: { count: number }) {
  const bounded = Math.max(0, Math.min(99, Math.trunc(count)));
  return (
    <Text accessibilityLabel={`${bounded} непрочитанных уведомлений`}>
      {bounded > 0 ? bounded : ""}
    </Text>
  );
}
export function StateMessage({
  kind,
  title,
  action,
}: {
  kind: "loading" | "empty" | "error" | "submitting" | "conflict" | "forbidden";
  title: string;
  action?: ReactNode;
}) {
  return (
    <View
      accessibilityRole={
        kind === "error" || kind === "conflict" || kind === "forbidden"
          ? "alert"
          : undefined
      }
      style={{ gap: uiTokens.spacing.sm, padding: 16, borderRadius: 12, backgroundColor: kind === "error" || kind === "conflict" || kind === "forbidden" ? "#fff0f0" : "#eaf2ef" }}
    >
      {kind === "loading" || kind === "submitting" ? (
        <ActivityIndicator />
      ) : null}
      <Text>{title}</Text>
      {action}
    </View>
  );
}
export { Modal };
