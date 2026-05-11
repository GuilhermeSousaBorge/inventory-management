"use client"

import { ExportCsvButton } from "@/components/reports/export-csv-button"
import { KpiCard } from "@/components/reports/kpi-card"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table } from "@/components/ui/table"
import { useAllIngredients } from "@/lib/ingredients"
import {
    reportsRangeFiltersSchema,
    useWasteReport,
    type ReportsRangeFiltersInput,
} from "@/lib/reports"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

function startOfMonthISO(): string {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

export default function WasteReportPage() {
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

    const query = useWasteReport({
        from: applied?.from ?? "",
        to: applied?.to ?? "",
        unit: applied?.unit || undefined,
        ingredient: applied?.ingredient || undefined,
    })

    function onSubmit(values: ReportsRangeFiltersInput) {
        setApplied(values)
    }

    const data = query.data ?? []
    const totalWaste = data.reduce((acc, r) => acc + r.wasteQuantity, 0)
    const totalAdjustments = data.reduce((acc, r) => acc + r.adjustmentCount, 0)
    const top = [...data].sort((a, b) => b.wasteQuantity - a.wasteQuantity)[0]

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/reports" className="hover:underline">
                        Relatórios
                    </Link>{" "}
                    › Desperdício
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    Relatório de desperdício
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Ajustes negativos (perdas, quebras, vencimentos) por ingrediente.
                </p>
                <p className="mt-2 rounded-lg bg-secondary/30 px-3 py-2 text-xs text-text-primary">
                    Apenas ajustes do tipo DECREASE entram aqui. Ajustes anteriores ao
                    SP4 (sem direção registrada) são ignorados.
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
                        <Controller
                            control={form.control}
                            name="unit"
                            render={({ field }) => (
                                <Select
                                    value={field.value || "__all"}
                                    onValueChange={(v) => field.onChange(v === "__all" ? "" : v)}
                                >
                                    <SelectTrigger id="f-unit">
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
                            )}
                        />
                    </Field>
                    <Field label="Ingrediente" htmlFor="f-ingredient">
                        <Controller
                            control={form.control}
                            name="ingredient"
                            render={({ field }) => (
                                <Select
                                    value={field.value || "__all"}
                                    onValueChange={(v) => field.onChange(v === "__all" ? "" : v)}
                                >
                                    <SelectTrigger id="f-ingredient">
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
                            )}
                        />
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
                        <KpiCard label="Volume desperdiçado" value={totalWaste.toLocaleString("pt-BR")} />
                        <KpiCard label="Ajustes registrados" value={totalAdjustments} />
                        <KpiCard label="Mais afetado" value={top?.ingredientName ?? "—"} subline={ top ? `${top.wasteQuantity.toLocaleString("pt-BR")} ${top.unitOfMeasure}` : undefined } />
                    </div>

                    <div className="flex justify-end">
                        <ExportCsvButton filename={`desperdicio_${todayISO()}.csv`} headers={[ "Ingrediente", "Unidade de medida", "Desperdiçado", "Ajustes", ]} rows={data.map((r) => [ r.ingredientName, r.unitOfMeasure, r.wasteQuantity, r.adjustmentCount, ])} />
                    </div>

                    {data.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                            <p className="text-sm text-text-secondary">
                                Nenhum dado para os filtros selecionados.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <THead>
                                <TR>
                                    <TH>Ingrediente</TH>
                                    <TH>UoM</TH>
                                    <TH>Desperdiçado</TH>
                                    <TH># ajustes</TH>
                                </TR>
                            </THead>
                            <TBody>
                                {data.map((r) => (
                                    <TR key={r.ingredientId}>
                                        <TD>{r.ingredientName}</TD>
                                        <TD>{r.unitOfMeasure}</TD>
                                        <TD>{r.wasteQuantity.toLocaleString("pt-BR")}</TD>
                                        <TD>{r.adjustmentCount}</TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </>
            )}
        </div>
    )
}