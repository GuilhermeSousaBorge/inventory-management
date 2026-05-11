"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import { useAllIngredients } from "@/lib/ingredients"
import {
    MOVEMENT_TYPES,
    useStockMovements,
    type MovementType,
} from "@/lib/stock-movements"
import { useAllUnits } from "@/lib/units"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AdjustmentDialog } from "./adjustment-dialog"

function typeLabel(t: MovementType) {
    return t === "ENTRY" ? "Entrada" : t === "EXIT" ? "Saída" : "Ajuste"
}

function typeVariant(t: MovementType) {
    return t === "ENTRY" ? "default" : t === "EXIT" ? "destructive" : "warning"
}

function StockMovementsPageInner() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const router = useRouter()
    const searchParams = useSearchParams()

    const ingredientParam = searchParams.get("ingredient") ?? ""
    const unitParam = searchParams.get("unit") ?? ""
    const typeParam = (searchParams.get("type") as MovementType | null) ?? undefined
    const fromParam = searchParams.get("from") ?? ""
    const toParam = searchParams.get("to") ?? ""

    const [page, setPage] = useState(0)
    const size = 20

    const query = useStockMovements({
        ingredient: ingredientParam || undefined,
        unit: unitParam || undefined,
        type: typeParam,
        from: fromParam || undefined,
        to: toParam || undefined,
        page,
        size,
    })

    const ingredients = useAllIngredients()
    const units = useAllUnits()

    const [open, setOpen] = useState(false)

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.delete(key)
        else params.set(key, value)
        setPage(0)
        router.replace(`/stock-movements?${params.toString()}`)
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Movimentações</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Histórico de entradas, saídas e ajustes.
                    </p>
                </div>
                {isOwner ? (
                    <Button onClick={() => setOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Novo ajuste
                    </Button>
                ) : null}
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Ingrediente" htmlFor="filter-ingredient">
                    <Select
                        id="filter-ingredient"
                        value={ingredientParam}
                        onChange={(e) => setFilter("ingredient", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {ingredients.data?.map((i) => (
                            <option key={i.id} value={i.id}>
                                {i.name}
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
                <Field label="Tipo" htmlFor="filter-type">
                    <Select
                        id="filter-type"
                        value={typeParam ?? ""}
                        onChange={(e) => setFilter("type", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {MOVEMENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {typeLabel(t)}
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
                    <p className="text-sm text-danger">Falha ao carregar movimentações.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhuma movimentação registrada.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Ingrediente</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Quantidade</TableHead>
                            <TableHead>Preço unit.</TableHead>
                            <TableHead>Origem/Motivo</TableHead>
                            <TableHead>Por</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((m) => {
                            const sign = m.type === "ENTRY" ? "+" : m.type === "EXIT" ? "−" : ""
                            return (
                                <TableRow key={m.id}>
                                    <TableCell>{new Date(m.createdAt).toLocaleString("pt-BR")}</TableCell>
                                    <TableCell>
                                        <Badge variant={typeVariant(m.type)}>{typeLabel(m.type)}</Badge>
                                    </TableCell>
                                    <TableCell>{m.ingredientName}</TableCell>
                                    <TableCell>{m.unitName}</TableCell>
                                    <TableCell>
                                        {sign}
                                        {m.quantity}
                                    </TableCell>
                                    <TableCell>{m.unitPrice !== null ? `R$ ${m.unitPrice}` : "—"}</TableCell>
                                    <TableCell>
                                        {m.purchaseOrderId ? (
                                            <Link
                                                href={`/purchase-orders/${m.purchaseOrderId}`}
                                                className="text-primary hover:underline"
                                            >
                                                Compra #{m.purchaseOrderId.slice(0, 8)}
                                            </Link>
                                        ) : (
                                            m.reason ?? "—"
                                        )}
                                    </TableCell>
                                    <TableCell>{m.createdByName}</TableCell>
                                </TableRow>
                            )
                        })}
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

            <AdjustmentDialog open={open} onClose={() => setOpen(false)} />
        </div>
    )
}

export default function StockMovementsPage() {
    return (
        <Suspense fallback={null}>
            <StockMovementsPageInner />
        </Suspense>
    )
}