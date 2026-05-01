import { type InputHTMLAttributes, forwardRef } from "react"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    function Input({ className = "", ...rest }, ref) {
        return (
            <input
                ref={ref}
                className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-text-primary/5 disabled:cursor-not-allowed ${className}`}
                {...rest}
            />
        )
    },
)