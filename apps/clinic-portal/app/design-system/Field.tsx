import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };

export function Field({ label, hint, error, id, ...props }: FieldProps) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const describedBy = [hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(" ") || undefined;
  return <label className="vh-ds-field" htmlFor={fieldId}><span>{label}</span><input id={fieldId} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />{hint && <small id={`${fieldId}-hint`}>{hint}</small>}{error && <small id={`${fieldId}-error`} role="alert">{error}</small>}</label>;
}
