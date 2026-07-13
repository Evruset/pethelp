import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "critical";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`vh-ds-button vh-ds-button--${variant} ${className}`.trim()} {...props} />;
}
