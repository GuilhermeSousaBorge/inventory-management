import type { ReactNode } from "react";

type Variant = "neutral" | "success" | "danger" | "warning"

const VARIANT: Record<Variant, string> = {
    neutral: "bg-text-primary/10 text-text-primary",
    success: "bg-primary/15 text-primary",
    danger: "bg-danger/15 text-danger",
    warning: "bg-secondary/40 text-text-primary",
}

export function Badge({ variant = "neutral", children }: { variant?: Variant; children: ReactNode }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${VARIANT[variant]}`}
        >
            {children}
        </span>
    )
}