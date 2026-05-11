"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { usePurchaseOrder } from "@/lib/purchase-orders"
import Link from "next/link"
import { useParams } from "next/navigation"
import { PurchaseOrderForm } from "../../purchase-order-form"

export default function EditPurchaseOrderPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id ?? ""
    const { user } = useAuth()
    const query = usePurchaseOrder(id)

    if (!user) return null
    if (user.role !== "OWNER") {
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-muted-foreground">
                    Você não tem permissão para editar compras.
                </p>
            </div>
        )
    }

    if (query.isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-foreground/5" />
                ))}
            </div>
        )
    }
    if (query.isError) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">Não foi possível carregar a compra.</p>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                    <Link href="/purchase-orders">
                        <Button variant="ghost" size="sm">
                            Voltar
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const po = query.data!
    if (po.status !== "PENDING") {
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-muted-foreground">
                    Esta compra já está {po.status === "RECEIVED" ? "recebida" : "cancelada"} e não pode mais ser editada.
                </p>
                <Link href={`/purchase-orders/${po.id}`}>
                    <Button className="mt-4" variant="ghost">
                        Voltar para a compra
                    </Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <nav className="text-sm text-muted-foreground">
                <Link href="/purchase-orders" className="hover:underline">
                    Compras
                </Link>{" "}
                › <span className="text-foreground">Editar #{po.id.slice(0, 8)}</span>
            </nav>
            <h1 className="text-2xl font-semibold text-foreground">Editar compra</h1>
            <PurchaseOrderForm mode="edit" initial={po} />
        </div>
    )
}