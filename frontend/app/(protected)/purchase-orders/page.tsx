"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import {
    PURCHASE_ORDER_STATUSES,
    usePurchaseOrders,
    type PurchaseOrderStatus,
} from "@/lib/purchase-orders"
import { useActiveSuppliers } from "@/lib/suppliers"
import { useAllUnits } from "@/lib/units"
import { Eye, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function statusLabel(s: PurchaseOrderStatus) {
    return s === "PENDING" ? "Pendente" : s === "RECEIVED" ? "Recebida" : "Cancelada"
}

function statusVariant(s: PurchaseOrderStatus) {
    return s === "PENDING" ? "warning" : s === "RECEIVED" ? "success" : "neutral"
}

function PurchaseOrdersPageInner() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const router = useRouter()
    const searchParams = useSearchParams()

    const statusParamRaw = searchParams.get("status")
    // default = PENDING (only when nothing in URL)
    const statusParam: PurchaseOrderStatus | undefined =
        statusParamRaw === null
            ? "PENDING"
            : statusParamRaw === ""
              ? undefined
              : (statusParamRaw as PurchaseOrderStatus)
    const supplierParam = searchParams.get("supplier") ?? ""
    const unitParam = searchParams.get("unit") ?? ""
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const query = usePurchaseOrders({
        status: statusParam,
        supplier: supplierParam || undefined,
        unit: unitParam || undefined,
        from: fromParam || undefined,
        to: toParam || undefined,
        page,
        size,
    })

    const suppliers = useActiveSuppliers()
    const units = useAllUnits()

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.set(key, "")
        else params.set(key, value)
        setPage(0)
        router.replace(`/purchase-orders?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Compras</h1>
                    <p className="mt-1 text-sm text-text-secondary">Ordens de compra a fornecedores.</p>
                </div>
                {isOwner ? (
                    <Link href="/purchase-orders/nova">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Nova compra
                        </Button>
                    </Link>
                ) : null}
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Status" htmlFor="filter-status">
                    <Select
                        id="filter-status"
                        value={statusParam ?? ""}
                        onChange={(e) => setFilter("status", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {PURCHASE_ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {statusLabel(s)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Fornecedor" htmlFor="filter-supplier">
                    <Select
                        id="filter-supplier"
                        value={supplierParam}
                        onChange={(e) => setFilter("supplier", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {suppliers.data?.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Unidade" htmlFor="filter-unit">
                    <Select
                        id="filter-unit"
                        value={unitParam}
                        onChange={(e) => setFilter("unit", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
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
                    <p className="text-sm text-danger">Falha ao carregar compras.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhuma compra encontrada.</p>
                    {isOwner ? (
                        <Link href="/purchase-orders/nova">
                            <Button className="mt-4">Criar primeira compra</Button>
                        </Link>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nº</TH>
                            <TH>Fornecedor</TH>
                            <TH>Unidade</TH>
                            <TH>Status</TH>
                            <TH>Esperada</TH>
                            <TH>Total</TH>
                            <TH>Criada</TH>
                            <TH className="w-px text-right">Ações</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((po) => (
                            <TR key={po.id}>
                                <TD className="font-mono">#{po.id.slice(0, 8)}</TD>
                                <TD>{po.supplierName}</TD>
                                <TD>{po.unitName}</TD>
                                <TD>
                                    <Badge variant={statusVariant(po.status)}>{statusLabel(po.status)}</Badge>
                                </TD>
                                <TD>{po.expectedAt ?? "—"}</TD>
                                <TD>R$ {po.totalCost.toFixed(2)}</TD>
                                <TD>{new Date(po.createdAt).toLocaleDateString("pt-BR")}</TD>
                                <TD className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Link
                                            href={`/purchase-orders/${po.id}`}
                                            className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                            aria-label={`Ver compra #${po.id.slice(0, 8)}`}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                        {isOwner && po.status === "PENDING" ? (
                                            <Link
                                                href={`/purchase-orders/${po.id}/editar`}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar compra #${po.id.slice(0, 8)}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Link>
                                        ) : null}
                                    </div>
                                </TD>
                            </TR>
                        ))}
                    </TBody>
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

export default function PurchaseOrdersPage() {
    return (
        <Suspense fallback={null}>
            <PurchaseOrdersPageInner />
        </Suspense>
    )
}