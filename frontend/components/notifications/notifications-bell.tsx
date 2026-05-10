"use client"

import { useActiveNotificationsBell } from "@/lib/notifications"
import { Bell } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60_000)
    if (m < 1) return "agora"
    if (m < 60) return `há ${m}min`
    const h = Math.floor(m / 60)
    if (h < 24) return `há ${h}h`
    const d = Math.floor(h / 24)
    return `há ${d}d`
}

export function NotificationsBell() {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const { total, items, isLoading, isError, refetch } = useActiveNotificationsBell()

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        if (open) document.addEventListener("mousedown", onClickOutside)
        return () => document.removeEventListener("mousedown", onClickOutside)
    }, [open])

    const badge = total > 9 ? "9+" : total > 0 ? String(total) : null

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-primary/70 transition hover:bg-text-primary/5 hover:text-text-primary" aria-label="Notificações" >
                <Bell className="h-5 w-5" />
                {badge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                        {badge}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div className="absolute right-0 mt-2 w-80 max-w-sm overflow-hidden rounded-lg border border-border/40 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
                        <p className="text-sm font-medium text-text-primary">
                            Alertas ativos ({total})
                        </p>
                        <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline" >
                            Ver todos →
                        </Link>
                    </div>
                    {isLoading ? (
                        <div className="space-y-2 p-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-12 animate-pulse rounded-md bg-text-primary/5" />
                            ))}
                        </div>
                    ) : isError ? (
                        <div className="px-4 py-6 text-center">
                            <p className="text-sm text-danger">
                                Não foi possível carregar alertas.
                            </p>
                            <button type="button" onClick={() => refetch()} className="mt-2 text-xs text-primary hover:underline" >
                                Tentar novamente
                            </button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                            <p className="text-sm text-text-secondary">
                                Nenhum alerta ativo no momento.
                            </p>
                        </div>
                    ) : (
                        <ul className="max-h-80 overflow-y-auto">
                            {items.map((n) => (
                                <li key={n.id} className="border-b border-border/30 last:border-0">
                                    <Link href={`/notifications/${n.id}`} onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-text-primary/5" >
                                        <p className="truncate text-sm font-medium text-text-primary">
                                            {n.ingredientName} · {n.unitName}
                                        </p>
                                        <p className="truncate text-xs text-text-secondary">
                                            {n.message}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-text-secondary/70">
                                            {relativeTime(n.createdAt)}
                                        </p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}
        </div>
    )
}