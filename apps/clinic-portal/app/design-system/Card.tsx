import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`vh-ds-card ${className}`.trim()} {...props} />;
}
