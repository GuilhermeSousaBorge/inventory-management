"use client"

import { ExportCsvButton } from "@/components/reports/export-csv-button"
import { KpiCard } from "@/components/reports/kpi-card"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAllIngredients } from "@/lib/ingredients"
import {
    reportsRangeFiltersSchema,
    useConsumptionReport,
    type ReportsRangeFiltersInput,
} from "@/lib/reports"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"

function startOfMonthISO(): string {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

export default function ConsumptionReportPage() {
    const [applied, setApplied] = useState<ReportsRangeFiltersInput | null>(null)
    const units = useAllUnits()
    const ingredients = useAllIngredients()

    const form = useForm<ReportsRangeFiltersInput>({
        resolver: zodResolver(reportsRangeFiltersSchema),
        defaultValues: {
            from: startOfMonthISO(),
            to: todayISO(),
            unit: "",
            ingredient: "",
        },
    })

    const query = useConsumptionReport({
        from: applied?.from ?? "",
        to: applied?.to ?? "",
        unit: applied?.unit || undefined,
        ingredient: applied?.ingredient || undefined,
    })

    function onSubmit(values: ReportsRangeFiltersInput) {
        setApplied(values)
    }

    const data = query.data ?? []
    const totalQty = data.reduce((acc, r) => acc + r.totalQuantity, 0)
    const distinctItems = data.length
    const top = [...data].sort((a, b) => b.totalQuantity - a.totalQuantity)[0]

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/reports" className="hover:underline">
                        Relatórios
                    </Link>{" "}
                    › Consumo
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    Relatório de consumo
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Total de saídas (EXIT) por ingrediente no período.
                </p>
            </header>

            <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-xl border border-border/40 bg-white p-5" >
                <div className="flex flex-wrap items-end gap-3">
                    <Field label="De" htmlFor="f-from" error={form.formState.errors.from?.message} >
                        <Input id="f-from" type="date" {...form.register("from")} />
                    </Field>
                    <Field label="Até" htmlFor="f-to" error={form.formState.errors.to?.message} >
                        <Input id="f-to" type="date" {...form.register("to")} />
                    </Field>
                    <Field label="Unidade" htmlFor="f-unit">
                        <Select id="f-unit" {...form.register("unit")}>
                            <option value="">Todas</option>
                            {units.data?.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Ingrediente" htmlFor="f-ingredient">
                        <Select id="f-ingredient" {...form.register("ingredient")}>
                            <option value="">Todos</option>
                            {ingredients.data?.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Button type="submit">Aplicar</Button>
                </div>
            </form>

            {!applied ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">
                        Selecione um período e clique em Aplicar.
                    </p>
                </div>
            ) : query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar relatório.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-3">
                        <KpiCard label="Total geral" value={totalQty.toLocaleString("pt-BR")} />
                        <KpiCard label="Itens distintos" value={distinctItems} />
                        <KpiCard label="Mais consumido" value={top?.ingredientName ?? "—"} subline={ top ? `${top.totalQuantity.toLocaleString("pt-BR")} ${top.unitOfMeasure}` : undefined } />
                    </div>

                    <div className="flex justify-end">
                        <ExportCsvButton filename={`consumo_${todayISO()}.csv`} headers={[ "Ingrediente", "Unidade de medida", "Total", "Movimentos", ]} rows={data.map((r) => [ r.ingredientName, r.unitOfMeasure, r.totalQuantity, r.movementCount, ])} />
                    </div>

                    {data.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                            <p className="text-sm text-text-secondary">
                                Nenhum dado para os filtros selecionados.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ingrediente</TableHead>
                                    <TableHead>Unidade de medida</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead># movimentos</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((r) => (
                                    <TableRow key={r.ingredientId}>
                                        <TableCell>{r.ingredientName}</TableCell>
                                        <TableCell>{r.unitOfMeasure}</TableCell>
                                        <TableCell>{r.totalQuantity.toLocaleString("pt-BR")}</TableCell>
                                        <TableCell>{r.movementCount}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </>
            )}
        </div>
    )
}