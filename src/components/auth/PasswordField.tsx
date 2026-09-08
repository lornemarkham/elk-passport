"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * A password input you can actually read.
 *
 * Hiding a password protects against somebody reading your screen, which is a
 * real risk in a café and no risk at all alone at a desk. Refusing to let a
 * person check what they typed is why long passwords get abandoned for short
 * ones, and it is why the field somebody mistypes twice becomes an account
 * they cannot get into.
 *
 * The toggle reports state through `aria-pressed` and announces which action it
 * performs, so it is usable without seeing the icon change.
 */
export function PasswordField({
  value,
  onChange,
  placeholder = "Password",
  autoComplete,
  describedBy,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="min-h-11 pr-12 text-base"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
