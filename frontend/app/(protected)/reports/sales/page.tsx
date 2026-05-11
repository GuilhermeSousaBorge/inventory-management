"use client"

import { ExportCsvButton } from "@/components/reports/export-csv-button"
import { KpiCard } from "@/components/reports/kpi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAllProducts } from "@/lib/products"
import {
    reportsRangeFiltersSchema,
    useSalesReport,
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
function brl(n: number): string {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function SalesReportPage() {
    const [applied, setApplied] = useState<ReportsRangeFiltersInput | null>(null)
    const units = useAllUnits()
    const products = useAllProducts()

    const form = useForm<ReportsRangeFiltersInput>({
        resolver: zodResolver(reportsRangeFiltersSchema),
        defaultValues: {
            from: startOfMonthISO(),
            to: todayISO(),
            unit: "",
            product: "",
        },
    })

    const query = useSalesReport({
        from: applied?.from ?? "",
        to: applied?.to ?? "",
        unit: applied?.unit || undefined,
        product: applied?.product || undefined,
    })

    function onSubmit(values: ReportsRangeFiltersInput) {
        setApplied(values)
    }

    const data = query.data ?? []
    const totalRevenue = data.reduce((a, r) => a + r.revenue, 0)
    const totalOrders = data.reduce((a, r) => a + r.ordersCount, 0)
    const top = [...data].sort((a, b) => b.revenue - a.revenue)[0]

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/reports" className="hover:underline">
                        Relatórios
                    </Link>{" "}
                    › Vendas
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    Relatório de vendas
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Pedidos concluídos por produto e receita gerada.
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
                    <Field label="Produto" htmlFor="f-product">
                        <Select id="f-product" {...form.register("product")}>
                            <option value="">Todos</option>
                            {products.data?.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.size}
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
                        <KpiCard label="Receita total" value={brl(totalRevenue)} />
                        <KpiCard label="Pedidos" value={totalOrders} />
                        <KpiCard label="Produto top" value={top ? `${top.productName} ${top.size}` : "—"} subline={top ? brl(top.revenue) : undefined} />
                    </div>

                    <div className="flex justify-end">
                        <ExportCsvButton filename={`vendas_${todayISO()}.csv`} headers={[ "Produto", "Tamanho", "Unidades", "Receita", "Pedidos", ]} rows={data.map((r) => [ r.productName, r.size, r.unitsSold, r.revenue, r.ordersCount, ])} />
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
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Unidades</TableHead>
                                    <TableHead>Receita</TableHead>
                                    <TableHead># pedidos</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((r) => (
                                    <TableRow key={r.productId}>
                                        <TableCell>
                                            {r.productName}{" "}
                                            <Badge variant="outline">{r.size}</Badge>
                                        </TableCell>
                                        <TableCell>{r.unitsSold}</TableCell>
                                        <TableCell>{brl(r.revenue)}</TableCell>
                                        <TableCell>{r.ordersCount}</TableCell>
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