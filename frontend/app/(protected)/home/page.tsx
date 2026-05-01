"use client"

import { useAuth } from "@/lib/auth"
import Link from "next/link"

export default function HomePage() {
    const { user } = useAuth()
    if (!user) return null

    const firstName = user.name.split(" ")[0]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-text-primary">
                    Bem-vinda, {firstName} 👋
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Aqui está o resumo da operação. Em breve: dashboard completo (vendas, estoque, alertas).
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Link
                    href="/unidades"
                    className="rounded-xl border border-border/40 bg-white p-5 transition hover:border-primary"
                >
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Unidades</p>
                    <p className="mt-1 text-base font-semibold text-text-primary">Ver unidades</p>
                </Link>
                <Link
                    href="/me"
                    className="rounded-xl border border-border/40 bg-white p-5 transition hover:border-primary"
                >
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Seu perfil</p>
                    <p className="mt-1 text-base font-semibold text-text-primary">
                        {user.role} · {user.name}
                    </p>
                </Link>
            </div>
        </div>
    )
}