"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAllIngredients } from "@/lib/ingredients"
import { useLowStock, useStock } from "@/lib/stock"
import { useAllUnits } from "@/lib/units"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"

function StockPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const unitParam = searchParams.get("unit") ?? ""
    const ingredientParam = searchParams.get("ingredient") ?? ""
    const belowMin = searchParams.get("belowMin") === "true"

    const [page, setPage] = useState(0)
    const size = 20

    const list = useStock({
        unit: unitParam || undefined,
        ingredient: ingredientParam || undefined,
        page,
        size,
    })
    const low = useLowStock({ page, size })
    const query = belowMin ? low : list

    const units = useAllUnits()
    const ingredients = useAllIngredients()

    const ingredientById = useMemo(() => {
        const m = new Map<string, { unitOfMeasure: string }>()
        ingredients.data?.forEach((i) => m.set(i.id, { unitOfMeasure: i.unitOfMeasure }))
        return m
    }, [ingredients.data])

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    function setFilter(key: "unit" | "ingredient" | "belowMin", value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "" || value === "false") params.delete(key)
        else params.set(key, value)
        setPage(0)
        router.replace(`/stock?${params.toString()}`)
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-text-primary">Estoque</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Saldos atuais por unidade e ingrediente.
                </p>
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Unidade" htmlFor="filter-unit">
                    <Select
                        value={unitParam || "__all"}
                        onValueChange={(v) => setFilter("unit", v === "__all" ? "" : v)}
                        disabled={belowMin}
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
                <Field label="Ingrediente" htmlFor="filter-ingredient">
                    <Select
                        value={ingredientParam || "__all"}
                        onValueChange={(v) => setFilter("ingredient", v === "__all" ? "" : v)}
                        disabled={belowMin}
                    >
                        <SelectTrigger id="filter-ingredient">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">Todos</SelectItem>
                            {ingredients.data?.map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                    {i.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <label className="flex items-center gap-2 text-sm text-text-primary">
                    <input
                        type="checkbox"
                        checked={belowMin}
                        onChange={(e) => setFilter("belowMin", e.target.checked ? "true" : "false")}
                    />
                    Apenas abaixo do mínimo
                </label>
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar estoque.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum saldo registrado.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ingrediente</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Quantidade</TableHead>
                            <TableHead>Mínimo</TableHead>
                            <TableHead>Custo médio</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Atualizado em</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((s) => {
                            const uom = ingredientById.get(s.ingredientId)?.unitOfMeasure ?? ""
                            return (
                                <TableRow key={s.id}>
                                    <TableCell>{s.ingredientName}</TableCell>
                                    <TableCell>{s.unitName}</TableCell>
                                    <TableCell>
                                        {s.quantity} {uom}
                                    </TableCell>
                                    <TableCell>
                                        {s.minimumQty} {uom}
                                    </TableCell>
                                    <TableCell>R$ {s.averageCost.toFixed(4)}</TableCell>
                                    <TableCell>
                                        <Badge variant={s.belowMinimum ? "destructive" : "default"}>
                                            {s.belowMinimum ? "Abaixo" : "OK"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{new Date(s.updatedAt).toLocaleString("pt-BR")}</TableCell>
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
        </div>
    )
}

export default function StockPage() {
    return (
        <Suspense fallback={null}>
            <StockPageInner />
        </Suspense>
    )
}