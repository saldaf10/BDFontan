import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  children: ReactNode;
};

export function FormField({ label, children }: FormFieldProps) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-fontan-ink shadow-sm outline-none focus:border-fontan-blue";
