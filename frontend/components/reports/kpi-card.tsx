import type { ReactNode } from "react"

type Props = {
    label: string
    value: ReactNode
    subline?: string
}

export function KpiCard({ label, value, subline }: Props) {
    return (
        <div className="rounded-xl border border-border/40 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
            {subline ? (
                <p className="mt-1 text-xs text-text-secondary">{subline}</p>
            ) : null}
        </div>
    )
}