import { type SelectHTMLAttributes, forwardRef } from "react"

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
    function Select({ className = "", children, ...rest }, ref) {
        return (
            <select
                ref={ref}
                className={`w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-text-primary/5 disabled:cursor-not-allowed ${className}`}
                {...rest}
            >
                {children}
            </select>
        )
    },
)