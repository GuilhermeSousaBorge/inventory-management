import { type ButtonHTMLAttributes, forwardRef } from "react"

type Variant = "primary" | "secondary" | "danger" | "ghost"
type Size = "sm" | "md"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    size?: Size
}

const VARIANT: Record<Variant, string> = {
    primary: "bg-primary text-white hover:brightness-95 focus:ring-primary/40",
    secondary: "bg-secondary text-text-primary hover:brightness-95 focus:ring-secondary/40",
    danger: "bg-danger text-white hover:brightness-95 focus:ring-danger/40",
    ghost: "bg-transparent text-text-primary hover:bg-text-primary/5 focus:ring-text-primary/20",
}

const SIZE: Record<Size, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
    { className = "", variant = "primary", size = "md", ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            className={`inline-flex items-center justify-center rounded-lg font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
            {...rest}
        />
    )
})