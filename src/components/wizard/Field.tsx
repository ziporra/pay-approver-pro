import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  id,
  hint,
  error,
  required,
  type = "text",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
      {...(required ? { required } : {})}
      {...(className ? { className } : {})}
    >
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder ?? ""}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
