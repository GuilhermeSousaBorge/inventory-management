"use client"

import { X } from "lucide-react"
import { type ReactNode, useEffect } from "react"

type Props = {
    open: boolean
    onClose: () => void
    title: string
    children: ReactNode
    footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: Props) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.body.style.overflow = "hidden"
        window.addEventListener("keydown", onKey)
        return () => {
            document.body.style.overflow = ""
            window.removeEventListener("keydown", onKey)
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={onClose}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="w-full max-w-md rounded-2xl border border-border/40 bg-white shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
                    <h2 className="text-base font-semibold text-text-primary">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-primary/60 hover:text-text-primary"
                        aria-label="Fechar"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="px-5 py-4">{children}</div>
                {footer ? (
                    <div className="flex justify-end gap-2 border-t border-border/40 px-5 py-3">{footer}</div>
                ) : null}
            </div>
        </div>
    )
}