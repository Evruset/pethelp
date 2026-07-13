import type { HTMLAttributes } from "react";

type StatusProps = HTMLAttributes<HTMLSpanElement> & { tone?: "success" | "warning" | "critical" | "neutral" };

export function Status({ tone = "neutral", className = "", ...props }: StatusProps) {
  return <span role="status" className={`vh-ds-status vh-ds-status--${tone} ${className}`.trim()} {...props} />;
}
