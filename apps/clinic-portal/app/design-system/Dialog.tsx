import type { HTMLAttributes } from "react";

export function Dialog({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`vh-ds-dialog ${className}`.trim()} role="dialog" aria-modal="true" {...props} />;
}

export function Sheet({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <aside className={`vh-ds-sheet ${className}`.trim()} role="dialog" aria-modal="true" {...props} />;
}
