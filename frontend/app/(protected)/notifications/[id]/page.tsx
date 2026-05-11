"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isApiError, useAuth } from "@/lib/auth"
import {
    useNotification,
    useResolveNotification,
    type NotificationStatus,
} from "@/lib/notifications"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

function statusVariant(s: NotificationStatus) {
    return s === "ACTIVE" ? "destructive" : "outline"
}

function statusLabel(s: NotificationStatus) {
    return s === "ACTIVE" ? "Ativo" : "Resolvido"
}

function extractUom(message: string): string {
    const match = message.match(/:\s*[\d.,]+\s+(\S+)\s+≤/)
    return match?.[1] ?? ""
}

export default function NotificationDetailPage() {
    const { user } = useAuth()
    const params = useParams<{ id: string }>()
    const id = params.id
    const query = useNotification(id)
    const resolveMutation = useResolveNotification()
    const [confirmOpen, setConfirmOpen] = useState(false)

    if (query.isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-foreground/5" />
                ))}
            </div>
        )
    }

    if (query.isError || !query.data) {
        return (
            <div className="text-center">
                <p className="text-sm text-destructive">Não foi possível carregar o alerta.</p>
                <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                    Tentar novamente
                </Button>
            </div>
        )
    }

    const n = query.data
    const uom = extractUom(n.message)
    const canResolve = user?.role === "OWNER" && n.status === "ACTIVE"

    async function onConfirmResolve() {
        try {
            await resolveMutation.mutateAsync(n.id)
            toast.success("Alerta marcado como resolvido")
            setConfirmOpen(false)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao resolver alerta")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm text-muted-foreground">
                        <Link href="/notifications" className="hover:underline">
                            Alertas
                        </Link>{" "}
                        › #{n.id.slice(0, 8)}
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold text-foreground">
                        Alerta de estoque baixo
                    </h1>
                </div>
                {canResolve ? (
                    <Button onClick={() => setConfirmOpen(true)}>Resolver</Button>
                ) : null}
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/40 bg-white p-5">
                    <h2 className="text-base font-semibold text-foreground">Alerta</h2>
                    <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Tipo</dt>
                            <dd className="text-foreground">{n.type}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Status</dt>
                            <dd>
                                <Badge variant={statusVariant(n.status)}>
                                    {statusLabel(n.status)}
                                </Badge>
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Ingrediente</dt>
                            <dd>
                                <Link href={`/ingredients/${n.ingredientId}`} className="text-primary hover:underline" >
                                    {n.ingredientName}
                                </Link>
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Unidade</dt>
                            <dd className="text-foreground">{n.unitName}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Mensagem</dt>
                            <dd className="text-right text-foreground">{n.message}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Disparado em</dt>
                            <dd className="text-foreground">
                                {new Date(n.createdAt).toLocaleString("pt-BR")}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Resolvido em</dt>
                            <dd className="text-foreground">
                                {n.resolvedAt
                                    ? new Date(n.resolvedAt).toLocaleString("pt-BR")
                                    : "—"}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Resolvido por</dt>
                            <dd className="text-foreground">
                                {n.resolvedBy
                                    ? n.resolvedBy.name
                                    : n.status === "RESOLVED"
                                      ? "Resolução automática"
                                      : "—"}
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="rounded-xl border border-border/40 bg-white p-5">
                    <h2 className="text-base font-semibold text-foreground">
                        Saldo no disparo
                    </h2>
                    <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Quantidade no momento</dt>
                            <dd className="text-foreground">
                                {n.triggeredQuantity} {uom}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Mínimo configurado</dt>
                            <dd className="text-foreground">
                                {n.minQuantity} {uom}
                            </dd>
                        </div>
                    </dl>
                    <Link href={`/stock?ingredient=${n.ingredientId}&unit=${n.unitId}`} className="mt-4 inline-block text-sm text-primary hover:underline" >
                        Ver estoque atual deste ingrediente nesta unidade →
                    </Link>
                </div>
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Resolver alerta</AlertDialogTitle>
                        <AlertDialogDescription>
                            Marcar este alerta como resolvido? A resolução manual não recoloca estoque — confirme apenas se o problema já foi tratado (compra recebida, ajuste lançado, etc.).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={resolveMutation.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={onConfirmResolve} disabled={resolveMutation.isPending}>
                            {resolveMutation.isPending ? "Processando..." : "Resolver"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}