"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
    return s === "ACTIVE" ? "destructive" : "outline"
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
                <h1 className="text-2xl font-semibold text-foreground">Alertas</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Alertas operacionais — estoque abaixo do mínimo.
                </p>
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <Label htmlFor="filter-status">Status</Label>
                    <Select
                        value={statusParam || "__all"}
                        onValueChange={(v) => setFilter("status", v === "__all" ? "" : v)}
                    >
                        <SelectTrigger id="filter-status">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">Todos</SelectItem>
                            {NOTIFICATION_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {statusLabel(s)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="filter-unit">Unidade</Label>
                    <Select
                        value={unitParam || "__all"}
                        onValueChange={(v) => setFilter("unit", v === "__all" ? "" : v)}
                    >
                        <SelectTrigger id="filter-unit">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">Todas</SelectItem>
                            {units.data?.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="filter-from">De</Label>
                    <Input id="filter-from" type="date" value={fromParam} onChange={(e) => setFilter("from", e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="filter-to">Até</Label>
                    <Input id="filter-to" type="date" value={toParam} onChange={(e) => setFilter("to", e.target.value)} />
                </div>
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-foreground/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <p className="text-sm text-destructive">Falha ao carregar alertas.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum alerta no período.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ingrediente</TableHead>
                            <TableCell>Unidade</TableCell>
                            <TableCell>Mensagem</TableCell>
                            <TableCell>Saldo / Mínimo</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Disparado em</TableCell>
                            <TableCell>Resolvido em</TableCell>
                            <TableCell>Ações</TableCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((n) => {
                            const uom = extractUom(n.message)
                            return (
                                <TableRow key={n.id}>
                                    <TableCell>{n.ingredientName}</TableCell>
                                    <TableCell>{n.unitName}</TableCell>
                                    <TableCell className="max-w-xs truncate" title={n.message}>
                                        {n.message}
                                    </TableCell>
                                    <TableCell>
                                        {n.triggeredQuantity} / {n.minQuantity} {uom}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant(n.status)}>
                                            {statusLabel(n.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(n.createdAt).toLocaleString("pt-BR")}
                                    </TableCell>
                                    <TableCell>
                                        {n.resolvedAt
                                            ? new Date(n.resolvedAt).toLocaleString("pt-BR")
                                            : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/notifications/${n.id}`} className="inline-flex items-center gap-1 text-primary hover:underline" >
                                            <Eye className="h-4 w-4" />
                                            Ver
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            )}

            {data && data.total > size ? (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
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