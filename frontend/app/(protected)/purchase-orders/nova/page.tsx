"use client"

import { useAuth } from "@/lib/auth"
import Link from "next/link"
import { PurchaseOrderForm } from "../purchase-order-form"

export default function NewPurchaseOrderPage() {
    const { user } = useAuth()

    if (!user) return null
    if (user.role !== "OWNER") {
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-text-secondary">
                    Você não tem permissão para criar compras.
                </p>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <nav className="text-sm text-text-secondary">
                <Link href="/purchase-orders" className="hover:underline">
                    Compras
                </Link>{" "}
                › <span className="text-text-primary">Nova</span>
            </nav>
            <h1 className="text-2xl font-semibold text-text-primary">Nova compra</h1>
            <PurchaseOrderForm mode="create" />
        </div>
    )
}