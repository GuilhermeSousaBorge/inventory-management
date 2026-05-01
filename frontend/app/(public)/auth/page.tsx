"use client"

import { Flame } from "lucide-react"

export default function AuthPage() {
    return (
        <main className="flex flex-1 items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-border/40 bg-white p-8 shadow-sm">
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger text-white">
                        <Flame className="h-6 w-6" />
                    </div>
                    <h1 className="mt-4 text-2xl font-semibold text-text-primary">
                        Forno Vivo
                    </h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Entre para gerenciar sua pizzaria
                    </p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
                    <div className="space-y-1.5">
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-text-primary"
                        >
                            E-mail
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            defaultValue="ana@pizzaria.com"
                            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-text-primary"
                            >
                                Senha
                            </label>
                            <a
                                href="#"
                                className="text-sm font-medium text-text-primary hover:underline"
                            >
                                Esqueci minha senha
                            </a>
                        </div>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            defaultValue="password"
                            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                        Entrar
                    </button>
                </form>

                <p className="mt-4 text-center text-xs text-text-secondary">
                    Demo: qualquer credencial funciona.
                </p>
            </div>
        </main>
    )
}
