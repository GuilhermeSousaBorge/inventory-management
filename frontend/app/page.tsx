"use client"

import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function RootPage() {
    const router = useRouter()
    const { status } = useAuth()

    useEffect(() => {
        if (status === "authenticated") router.replace("/home")
        else if (status === "unauthenticated") router.replace("/auth")
    }, [status, router])

    return (
        <div className="flex min-h-screen items-center justify-center text-sm text-text-secondary">
            Carregando...
        </div>
    )
}