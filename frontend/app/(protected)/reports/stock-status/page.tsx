"use client"

import { ExportCsvButton } from "@/components/reports/export-csv-button"
import { KpiCard } from "@/components/reports/kpi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { useStockStatusReport, type StockStatusRow } from "@/lib/reports"
import { useAllUnits } from "@/lib/units"
import Link from "next/link"
import { useState } from "react"

function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

function levelVariant(l: StockStatusRow["level"]) {
    return l === "LOW" ? "danger" : l === "WARNING" ? "warning" : "success"
}

function levelLabel(l: StockStatusRow["level"]) {
    return l === "LOW" ? "Baixo" : l === "WARNING" ? "Atenção" : "OK"
}

export default function StockStatusReportPage() {
    const [unit, setUnit] = useState("")
    const units = useAllUnits()
    const query = useStockStatusReport({ unit: unit || undefined })

    const data = query.data ?? []
    const total = data.length
    const lowCount = data.filter((r) => r.level === "LOW").length
    const warnCount = data.filter((r) => r.level === "WARNING").length

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/reports" className="hover:underline">
                        Relatórios
                    </Link>{" "}
                    › Status de estoque
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                    Status de estoque
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Visão atual de saldos vs. mínimos por unidade.
                </p>
            </header>

            <div className="rounded-xl border border-border/40 bg-white p-5">
                <Field label="Unidade" htmlFor="f-unit">
                    <Select id="f-unit" value={unit} onChange={(e) => setUnit(e.target.value)} >
                        <option value="">Todas</option>
                        {units.data?.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Select>
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
                    <p className="text-sm text-danger">Falha ao carregar relatório.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-3">
                        <KpiCard label="Total de itens" value={total} />
                        <KpiCard label="Em alerta (LOW)" value={lowCount} />
                        <KpiCard label="Em atenção (WARNING)" value={warnCount} />
                    </div>

                    <div className="flex justify-end">
                        <ExportCsvButton filename={`estoque_${todayISO()}.csv`} headers={[ "Ingrediente", "Unidade de medida", "Saldo", "Mínimo", "Nível", ]} rows={data.map((r) => [ r.ingredientName, r.unitOfMeasure, r.currentQuantity, r.minQuantity, r.level, ])} />
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
                                    <TH>Saldo</TH>
                                    <TH>Mínimo</TH>
                                    <TH>Nível</TH>
                                </TR>
                            </THead>
                            <TBody>
                                {data.map((r) => (
                                    <TR key={r.ingredientId}>
                                        <TD>{r.ingredientName}</TD>
                                        <TD>{r.unitOfMeasure}</TD>
                                        <TD>{r.currentQuantity.toLocaleString("pt-BR")}</TD>
                                        <TD>{r.minQuantity.toLocaleString("pt-BR")}</TD>
                                        <TD>
                                            <Badge variant={levelVariant(r.level)}>
                                                {levelLabel(r.level)}
                                            </Badge>
                                        </TD>
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