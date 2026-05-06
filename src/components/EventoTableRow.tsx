"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type EventoTableRowProps = {
  id: string;
  children: ReactNode;
};

export function EventoTableRow({ id, children }: EventoTableRowProps) {
  const router = useRouter();

  return (
    <tr
      role="link"
      tabIndex={0}
      className="cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fontan-blue/40"
      onClick={() => router.push(`/eventos/${id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/eventos/${id}`);
        }
      }}
    >
      {children}
    </tr>
  );
}
