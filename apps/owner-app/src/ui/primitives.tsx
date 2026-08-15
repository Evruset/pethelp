import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { uiTokens } from "./tokens";

export function Screen({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View
      accessibilityLabel={title}
      style={{
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
        padding: uiTokens.spacing.xl,
        gap: uiTokens.spacing.lg,
      }}
    >
      <Header title={title} />
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  disabled = false,
  variant = "primary",
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const quiet = variant !== "primary";
  const outlined = variant === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        justifyContent: "center",
        padding: 14,
        borderWidth: outlined ? 1 : 0,
        borderColor: outlined ? uiTokens.color.primary : "transparent",
        borderRadius: uiTokens.radius.card,
        backgroundColor: disabled
          ? uiTokens.color.disabled
          : quiet
            ? "transparent"
            : uiTokens.color.primary,
      }}
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
}: PropsWithChildren<{
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}>) {
  const body = (
    <View
      style={{
        padding: 14,
        opacity: disabled ? 0.55 : 1,
        borderWidth: 2,
        borderColor: selected
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
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}
export function StatusBadge({ label }: { label: string }) {
  return <Text accessibilityRole="text">{label}</Text>;
}
export function Header({ title }: { title: string }) {
  return (
    <Text accessibilityRole="header" style={uiTokens.typography.heading}>
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
      style={{ gap: uiTokens.spacing.sm }}
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
