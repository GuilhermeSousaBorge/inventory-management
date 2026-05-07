"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useOrder } from "@/lib/orders"
import Link from "next/link"
import { useParams } from "next/navigation"
import { OrderForm } from "../../order-form"

export default function EditOrderPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id ?? ""
    const { user } = useAuth()
    const query = useOrder(id)

    if (!user) return null
    if (user.role !== "OWNER") {
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-text-secondary">
                    Você não tem permissão para editar pedidos.
                </p>
            </div>
        )
    }

    if (query.isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                ))}
            </div>
        )
    }
    if (query.isError) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                <p className="text-sm text-danger">Não foi possível carregar o pedido.</p>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                    <Link href="/orders">
                        <Button variant="ghost" size="sm">
                            Voltar
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const order = query.data!
    if (order.status !== "PENDING") {
        const statusLabel =
            order.status === "IN_PROGRESS"
                ? "em preparo"
                : order.status === "COMPLETED"
                  ? "concluído"
                  : "cancelado"
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-text-secondary">
                    Este pedido já está {statusLabel} e não pode mais ser editado.
                </p>
                <Link href={`/orders/${order.id}`}>
                    <Button className="mt-4" variant="ghost">
                        Voltar para o pedido
                    </Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <nav className="text-sm text-text-secondary">
                <Link href="/orders" className="hover:underline">
                    Pedidos
                </Link>{" "}
                › <span className="text-text-primary">Editar #{order.id.slice(0, 8)}</span>
            </nav>
            <h1 className="text-2xl font-semibold text-text-primary">Editar pedido</h1>
            <OrderForm mode="edit" initial={order} />
        </div>
    )
}
