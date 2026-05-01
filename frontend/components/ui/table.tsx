import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react"

export function Table({ children }: { children: ReactNode }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-white">
            <table className="w-full text-sm">{children}</table>
        </div>
    )
}

export function THead({ children }: { children: ReactNode }) {
    return (
        <thead className="bg-text-primary/[0.04] text-xs uppercase tracking-wide text-text-secondary">
            {children}
        </thead>
    )
}

export function TBody({ children }: { children: ReactNode }) {
    return <tbody className="divide-y divide-border/40">{children}</tbody>
}

export function TR({ children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
    return (
        <tr className="transition hover:bg-text-primary/[0.03]" {...rest}>
            {children}
        </tr>
    )
}

export function TH({ children, className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th className={`px-4 py-3 text-left font-medium ${className}`} {...rest}>
            {children}
        </th>
    )
}

export function TD({ children, className = "", ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
    return (
        <td className={`px-4 py-3 text-text-primary ${className}`} {...rest}>
            {children}
        </td>
    )
}