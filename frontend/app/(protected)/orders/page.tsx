"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import {
    ORDER_STATUSES,
    useOrders,
    type OrderStatus,
} from "@/lib/orders"
import { useAllUnits } from "@/lib/units"
import { Eye, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

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

function OrdersPageInner() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const router = useRouter()
    const searchParams = useSearchParams()

    const statusParamRaw = searchParams.get("status")
    // default = PENDING (only when nothing in URL)
    const statusParam: OrderStatus | undefined =
        statusParamRaw === null
            ? "PENDING"
            : statusParamRaw === ""
              ? undefined
              : (statusParamRaw as OrderStatus)
    const unitParam = searchParams.get("unit") ?? ""
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const query = useOrders({
        status: statusParam,
        unit: unitParam || undefined,
        from: fromParam ? `${fromParam}T00:00:00` : undefined,
        to: toParam ? `${toParam}T23:59:59` : undefined,
        page,
        size,
    })

    const units = useAllUnits()

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.set(key, "")
        else params.set(key, value)
        setPage(0)
        router.replace(`/orders?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Pedidos</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Pedidos de cliente com workflow de preparo.
                    </p>
                </div>
                {isOwner ? (
                    <Link href="/orders/novo">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Novo pedido
                        </Button>
                    </Link>
                ) : null}
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Status" htmlFor="filter-status">
                    <Select
                        value={statusParam ?? "__all"}
                        onValueChange={(v) => setFilter("status", v === "__all" ? "" : v)}
                    >
                        <SelectTrigger id="filter-status">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">Todos</SelectItem>
                            {ORDER_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {statusLabel(s)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field label="Unidade" htmlFor="filter-unit">
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
                </Field>
                <Field label="De" htmlFor="filter-from">
                    <Input
                        id="filter-from"
                        type="date"
                        value={fromParam}
                        onChange={(e) => setFilter("from", e.target.value)}
                    />
                </Field>
                <Field label="Até" htmlFor="filter-to">
                    <Input
                        id="filter-to"
                        type="date"
                        value={toParam}
                        onChange={(e) => setFilter("to", e.target.value)}
                    />
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
                    <p className="text-sm text-danger">Falha ao carregar pedidos.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum pedido encontrado.</p>
                    {isOwner ? (
                        <Link href="/orders/novo">
                            <Button className="mt-4">Criar primeiro pedido</Button>
                        </Link>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nº</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Itens</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Criado</TableHead>
                            <TableHead className="w-px text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((o) => (
                            <TableRow key={o.id}>
                                <TableCell className="font-mono">#{o.id.slice(0, 8)}</TableCell>
                                <TableCell>{o.unitName}</TableCell>
                                <TableCell>
                                    <Badge variant={statusVariant(o.status)}>
                                        {statusLabel(o.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell>{o.items?.length ?? "—"}</TableCell>
                                <TableCell>R$ {o.totalPrice.toFixed(2)}</TableCell>
                                <TableCell>
                                    {new Date(o.createdAt).toLocaleString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Link
                                            href={`/orders/${o.id}`}
                                            className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                            aria-label={`Ver pedido #${o.id.slice(0, 8)}`}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                        {isOwner && o.status === "PENDING" ? (
                                            <Link
                                                href={`/orders/${o.id}/editar`}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar pedido #${o.id.slice(0, 8)}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Link>
                                        ) : null}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {data && data.total > size ? (
                <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>
                        Página {page + 1} de {totalPages} · {size} por página
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page + 1 >= totalPages}
                        >
                            Próximo
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default function OrdersPage() {
    return (
        <Suspense fallback={null}>
            <OrdersPageInner />
        </Suspense>
    )
}
