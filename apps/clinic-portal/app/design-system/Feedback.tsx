import type { HTMLAttributes } from "react";

type FeedbackProps = HTMLAttributes<HTMLDivElement> & { kind?: "empty" | "loading" | "error" };

export function Feedback({ kind = "empty", className = "", ...props }: FeedbackProps) {
  return <div className={`vh-ds-feedback vh-ds-feedback--${kind} ${className}`.trim()} role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined} aria-live={kind === "loading" ? "polite" : undefined} {...props} />;
}
