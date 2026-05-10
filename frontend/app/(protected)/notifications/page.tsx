"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import {
    NOTIFICATION_STATUSES,
    useNotifications,
    type NotificationStatus,
} from "@/lib/notifications"
import { useAllUnits } from "@/lib/units"
import { Eye } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function statusVariant(s: NotificationStatus) {
    return s === "ACTIVE" ? "danger" : "neutral"
}

function statusLabel(s: NotificationStatus) {
    return s === "ACTIVE" ? "Ativo" : "Resolvido"
}

function extractUom(message: string): string {
    // formato backend: "<ing> abaixo do mínimo na unidade <unit>: <qty> <uom> ≤ <min> <uom>"
    const match = message.match(/:\s*[\d.,]+\s+(\S+)\s+≤/)
    return match?.[1] ?? ""
}

function NotificationsPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const statusParam =
        (searchParams.get("status") as NotificationStatus | null) ?? "ACTIVE"
    const unitParam = searchParams.get("unit") ?? ""
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const query = useNotifications({
        status: statusParam || undefined,
        unit: unitParam || undefined,
        from: fromParam || undefined,
        to: toParam || undefined,
        page,
        size,
    })
    const units = useAllUnits()

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.delete(key)
        else params.set(key, value)
        setPage(0)
        router.replace(`/notifications?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-text-primary">Alertas</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Alertas operacionais — estoque abaixo do mínimo.
                </p>
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Status" htmlFor="filter-status">
                    <Select id="filter-status" value={statusParam} onChange={(e) => setFilter("status", e.target.value)} >
                        <option value="">Todos</option>
                        {NOTIFICATION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {statusLabel(s)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Unidade" htmlFor="filter-unit">
                    <Select id="filter-unit" value={unitParam} onChange={(e) => setFilter("unit", e.target.value)} >
                        <option value="">Todas</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="De" htmlFor="filter-from">
                    <Input id="filter-from" type="date" value={fromParam} onChange={(e) => setFilter("from", e.target.value)} />
                </Field>
                <Field label="Até" htmlFor="filter-to">
                    <Input id="filter-to" type="date" value={toParam} onChange={(e) => setFilter("to", e.target.value)} />
                </Field>
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar alertas.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum alerta no período.</p>
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Ingrediente</TH>
                            <TH>Unidade</TH>
                            <TH>Mensagem</TH>
                            <TH>Saldo / Mínimo</TH>
                            <TH>Status</TH>
                            <TH>Disparado em</TH>
                            <TH>Resolvido em</TH>
                            <TH>Ações</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((n) => {
                            const uom = extractUom(n.message)
                            return (
                                <TR key={n.id}>
                                    <TD>{n.ingredientName}</TD>
                                    <TD>{n.unitName}</TD>
                                    <TD className="max-w-xs truncate" title={n.message}>
                                        {n.message}
                                    </TD>
                                    <TD>
                                        {n.triggeredQuantity} / {n.minQuantity} {uom}
                                    </TD>
                                    <TD>
                                        <Badge variant={statusVariant(n.status)}>
                                            {statusLabel(n.status)}
                                        </Badge>
                                    </TD>
                                    <TD>
                                        {new Date(n.createdAt).toLocaleString("pt-BR")}
                                    </TD>
                                    <TD>
                                        {n.resolvedAt
                                            ? new Date(n.resolvedAt).toLocaleString("pt-BR")
                                            : "—"}
                                    </TD>
                                    <TD>
                                        <Link href={`/notifications/${n.id}`} className="inline-flex items-center gap-1 text-primary hover:underline" >
                                            <Eye className="h-4 w-4" />
                                            Ver
                                        </Link>
                                    </TD>
                                </TR>
                            )
                        })}
                    </TBody>
                </Table>
            )}

            {data && data.total > size ? (
                <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>
                        Página {page + 1} de {totalPages} · {size} por página
                    </span>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} >
                            Anterior
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages} >
                            Próximo
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default function NotificationsPage() {
    return (
        <Suspense fallback={null}>
            <NotificationsPageInner />
        </Suspense>
    )
}