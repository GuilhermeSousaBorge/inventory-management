"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useCancelOrder,
    useCompleteOrder,
    useOrder,
    useStartOrder,
    type OrderStatus,
} from "@/lib/orders"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type ActionKind = "start" | "complete" | "cancel" | null

function statusLabel(s: OrderStatus) {
    return s === "PENDING"
        ? "Pendente"
        : s === "IN_PROGRESS"
          ? "Em preparo"
          : s === "COMPLETED"
            ? "Concluído"
            : "Cancelado"
}

function statusVariant(s: OrderStatus): "warning" | "default" | "outline" {
    return s === "PENDING" || s === "IN_PROGRESS"
        ? "warning"
        : s === "COMPLETED"
          ? "default"
          : "outline"
}

export default function OrderDetailPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id ?? ""
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"

    const query = useOrder(id)
    const start = useStartOrder()
    const complete = useCompleteOrder()
    const cancel = useCancelOrder()

    const [action, setAction] = useState<ActionKind>(null)

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

    const o = query.data!

    async function runAction() {
        if (!action) return
        try {
            if (action === "start") {
                await start.mutateAsync(o.id)
                toast.success("Pedido iniciado")
            } else if (action === "complete") {
                await complete.mutateAsync(o.id)
                toast.success("Pedido concluído")
            } else if (action === "cancel") {
                await cancel.mutateAsync(o.id)
                toast.success("Pedido cancelado")
            }
            setAction(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao executar ação")
        }
    }

    const actionLoading =
        action === "start"
            ? start.isPending
            : action === "complete"
              ? complete.isPending
              : action === "cancel"
                ? cancel.isPending
                : false

    return (
        <div className="space-y-6">
            <nav className="text-sm text-text-secondary">
                <Link href="/orders" className="hover:underline">
                    Pedidos
                </Link>{" "}
                › <span className="text-text-primary">#{o.id.slice(0, 8)}</span>
            </nav>

            <header className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-text-primary">
                        Pedido #{o.id.slice(0, 8)}
                    </h1>
                    <Badge variant={statusVariant(o.status)}>{statusLabel(o.status)}</Badge>
                </div>
                {isOwner ? (
                    <div className="flex gap-2">
                        {o.status === "PENDING" ? (
                            <>
                                <Link href={`/orders/${o.id}/editar`}>
                                    <Button variant="ghost">Editar</Button>
                                </Link>
                                <Button onClick={() => setAction("start")}>Iniciar</Button>
                                <Button variant="ghost" onClick={() => setAction("cancel")}>
                                    Cancelar
                                </Button>
                            </>
                        ) : null}
                        {o.status === "IN_PROGRESS" ? (
                            <Button onClick={() => setAction("complete")}>Concluir</Button>
                        ) : null}
                    </div>
                ) : null}
            </header>

            <section className="grid gap-3 rounded-xl border border-border/40 bg-white p-5 sm:grid-cols-2">
                <div>
                    <p className="text-xs text-text-secondary">Unidade</p>
                    <p className="text-sm text-text-primary">{o.unitName}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Criado em</p>
                    <p className="text-sm text-text-primary">
                        {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </p>
                </div>
                {o.startedAt ? (
                    <div>
                        <p className="text-xs text-text-secondary">Iniciado em</p>
                        <p className="text-sm text-text-primary">
                            {new Date(o.startedAt).toLocaleString("pt-BR")}
                        </p>
                    </div>
                ) : null}
                {o.completedAt ? (
                    <div>
                        <p className="text-xs text-text-secondary">Concluído em</p>
                        <p className="text-sm text-text-primary">
                            {new Date(o.completedAt).toLocaleString("pt-BR")}
                        </p>
                    </div>
                ) : null}
                {o.canceledAt ? (
                    <div>
                        <p className="text-xs text-text-secondary">Cancelado em</p>
                        <p className="text-sm text-text-primary">
                            {new Date(o.canceledAt).toLocaleString("pt-BR")}
                        </p>
                    </div>
                ) : null}
                {o.notes ? (
                    <div className="sm:col-span-2">
                        <p className="text-xs text-text-secondary">Observações</p>
                        <p className="text-sm text-text-primary">{o.notes}</p>
                    </div>
                ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Itens</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Qtd</TableHead>
                            <TableHead>Preço unit.</TableHead>
                            <TableHead>Subtotal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(o.items ?? []).map((it) => (
                            <TableRow key={it.id}>
                                <TableCell>{it.productName}</TableCell>
                                <TableCell>{it.quantity}</TableCell>
                                <TableCell>R$ {it.unitPrice.toFixed(2)}</TableCell>
                                <TableCell>R$ {it.subtotal.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="flex justify-end border-t border-border/40 pt-3 text-sm font-medium">
                    Total: <span className="ml-2">R$ {o.totalPrice.toFixed(2)}</span>
                </div>
            </section>

            <ConfirmDialog
                open={action === "start"}
                onClose={() => setAction(null)}
                onConfirm={runAction}
                title="Iniciar pedido"
                message="Os ingredientes serão descontados do estoque conforme as fichas técnicas, e a ação não pode ser desfeita."
                confirmLabel="Iniciar"
                confirmVariant="primary"
                loading={actionLoading}
            />

            <ConfirmDialog
                open={action === "complete"}
                onClose={() => setAction(null)}
                onConfirm={runAction}
                title="Concluir pedido"
                message="Marcar este pedido como concluído?"
                confirmLabel="Concluir"
                confirmVariant="primary"
                loading={actionLoading}
            />

            <ConfirmDialog
                open={action === "cancel"}
                onClose={() => setAction(null)}
                onConfirm={runAction}
                title="Cancelar pedido"
                message="Esta ação não pode ser desfeita."
                confirmLabel="Cancelar pedido"
                confirmVariant="danger"
                loading={actionLoading}
            />
        </div>
    )
}
