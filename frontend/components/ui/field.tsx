import type { ReactNode } from "react"

type Props = {
    label: string
    htmlFor?: string
    error?: string
    hint?: string
    children: ReactNode
    className?: string
}

export function Field({ label, htmlFor, error, hint, children, className = "" }: Props) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            <label htmlFor={htmlFor} className="block text-sm font-medium text-text-primary">
                {label}
            </label>
            {children}
            {error ? (
                <p className="text-xs text-danger">{error}</p>
            ) : hint ? (
                <p className="text-xs text-text-secondary">{hint}</p>
            ) : null}
        </div>
    )
}