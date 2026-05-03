"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useCancelPurchaseOrder,
    usePurchaseOrder,
    useReceivePurchaseOrder,
    type PurchaseOrderStatus,
} from "@/lib/purchase-orders"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

function statusLabel(s: PurchaseOrderStatus) {
    return s === "PENDING" ? "Pendente" : s === "RECEIVED" ? "Recebida" : "Cancelada"
}

function statusVariant(s: PurchaseOrderStatus) {
    return s === "PENDING" ? "warning" : s === "RECEIVED" ? "success" : "neutral"
}

export default function PurchaseOrderDetailPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id ?? ""
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"

    const query = usePurchaseOrder(id)
    const receive = useReceivePurchaseOrder()
    const cancel = useCancelPurchaseOrder()

    const [action, setAction] = useState<"receive" | "cancel" | null>(null)

    if (query.isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-text-primary/5" />
                ))}
            </div>
        )
    }
    if (query.isError) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                <p className="text-sm text-danger">Não foi possível carregar a compra.</p>
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
    const canAct = isOwner && po.status === "PENDING"

    async function onConfirmReceive() {
        try {
            await receive.mutateAsync(po.id)
            toast.success("Compra recebida")
            setAction(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao receber compra")
        }
    }

    async function onConfirmCancel() {
        try {
            await cancel.mutateAsync(po.id)
            toast.success("Compra cancelada")
            setAction(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao cancelar compra")
        }
    }

    return (
        <div className="space-y-6">
            <nav className="text-sm text-text-secondary">
                <Link href="/purchase-orders" className="hover:underline">
                    Compras
                </Link>{" "}
                › <span className="text-text-primary">#{po.id.slice(0, 8)}</span>
            </nav>

            <header className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-text-primary">Compra #{po.id.slice(0, 8)}</h1>
                    <Badge variant={statusVariant(po.status)}>{statusLabel(po.status)}</Badge>
                </div>
                {canAct ? (
                    <div className="flex gap-2">
                        <Link href={`/purchase-orders/${po.id}/editar`}>
                            <Button variant="ghost">Editar</Button>
                        </Link>
                        <Button onClick={() => setAction("receive")}>Receber</Button>
                        <Button variant="ghost" onClick={() => setAction("cancel")}>
                            Cancelar
                        </Button>
                    </div>
                ) : null}
            </header>

            <section className="grid gap-3 rounded-xl border border-border/40 bg-white p-5 sm:grid-cols-2">
                <div>
                    <p className="text-xs text-text-secondary">Fornecedor</p>
                    <p className="text-sm text-text-primary">{po.supplierName}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Unidade</p>
                    <p className="text-sm text-text-primary">{po.unitName}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Esperada</p>
                    <p className="text-sm text-text-primary">{po.expectedAt ?? "—"}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Criada</p>
                    <p className="text-sm text-text-primary">
                        {new Date(po.createdAt).toLocaleString("pt-BR")} por {po.createdByName}
                    </p>
                </div>
                {po.receivedAt ? (
                    <div>
                        <p className="text-xs text-text-secondary">Recebida em</p>
                        <p className="text-sm text-text-primary">
                            {new Date(po.receivedAt).toLocaleString("pt-BR")}
                        </p>
                    </div>
                ) : null}
                {po.canceledAt ? (
                    <div>
                        <p className="text-xs text-text-secondary">Cancelada em</p>
                        <p className="text-sm text-text-primary">
                            {new Date(po.canceledAt).toLocaleString("pt-BR")}
                        </p>
                    </div>
                ) : null}
                {po.notes ? (
                    <div className="sm:col-span-2">
                        <p className="text-xs text-text-secondary">Observações</p>
                        <p className="text-sm text-text-primary">{po.notes}</p>
                    </div>
                ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Itens</h2>
                <Table>
                    <THead>
                        <TR>
                            <TH>Ingrediente</TH>
                            <TH>Quantidade</TH>
                            <TH>Preço unit.</TH>
                            <TH>Subtotal</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {po.items.map((it) => (
                            <TR key={it.id}>
                                <TD>{it.ingredientName}</TD>
                                <TD>{it.quantity}</TD>
                                <TD>R$ {it.unitPrice.toFixed(4)}</TD>
                                <TD>R$ {(it.quantity * it.unitPrice).toFixed(2)}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
                <div className="flex justify-end border-t border-border/40 pt-3 text-sm font-medium">
                    Total: <span className="ml-2">R$ {po.totalCost.toFixed(2)}</span>
                </div>
            </section>

            <ConfirmDialog
                open={action === "receive"}
                onClose={() => setAction(null)}
                onConfirm={onConfirmReceive}
                title="Confirmar recebimento"
                message="Esta ação adiciona os itens ao estoque, atualiza o custo médio dos ingredientes e não pode ser desfeita."
                confirmLabel="Receber"
                confirmVariant="primary"
                loading={receive.isPending}
            />

            <ConfirmDialog
                open={action === "cancel"}
                onClose={() => setAction(null)}
                onConfirm={onConfirmCancel}
                title="Cancelar compra"
                message="Esta ação não pode ser desfeita."
                confirmLabel="Cancelar"
                confirmVariant="danger"
                loading={cancel.isPending}
            />
        </div>
    )
}