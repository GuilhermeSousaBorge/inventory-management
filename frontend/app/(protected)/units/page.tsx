"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useDeactivateUnit, useUnits, type Unit } from "@/lib/units"
import { Pencil, Plus, Power } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { UnitDialog } from "./unit-dialog"

export default function UnitsPage() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const [page, setPage] = useState(0)
    const size = 20
    const unitsQuery = useUnits(page, size)

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Unit | null>(null)
    const [confirm, setConfirm] = useState<Unit | null>(null)
    const deactivate = useDeactivateUnit()

    const data = unitsQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    async function onConfirm() {
        if (!confirm) return
        try {
            await deactivate.mutateAsync(confirm.id)
            toast.success("Unidade desativada")
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar unidade")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Unidades</h1>
                    <p className="mt-1 text-sm text-text-secondary">As unidades físicas da pizzaria.</p>
                </div>
                {isOwner ? (
                    <Button
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Nova unidade
                    </Button>
                ) : null}
            </header>

            {unitsQuery.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : unitsQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar unidades.</p>
                    <Button variant="ghost" size="sm" onClick={() => unitsQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhuma unidade cadastrada.</p>
                    {isOwner ? (
                        <Button
                            className="mt-4"
                            onClick={() => {
                                setEditing(null)
                                setDialogOpen(true)
                            }}
                        >
                            Criar primeira unidade
                        </Button>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>Endereço</TH>
                            <TH>Status</TH>
                            {isOwner ? <TH className="w-px text-right">Ações</TH> : null}
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((u) => (
                            <TR key={u.id}>
                                <TD>{u.name}</TD>
                                <TD className="max-w-[320px] truncate">{u.address ?? "—"}</TD>
                                <TD>
                                    <Badge variant={u.active ? "success" : "neutral"}>
                                        {u.active ? "Ativa" : "Inativa"}
                                    </Badge>
                                </TD>
                                {isOwner ? (
                                    <TD className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(u)
                                                    setDialogOpen(true)
                                                }}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar ${u.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            {u.active ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirm(u)}
                                                    className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                    aria-label={`Desativar ${u.name}`}
                                                >
                                                    <Power className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                    </TD>
                                ) : null}
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

            {isOwner ? (
                <UnitDialog open={dialogOpen} onClose={() => setDialogOpen(false)} unit={editing} />
            ) : null}

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={onConfirm}
                title="Desativar unidade"
                message={confirm ? `Confirma desativar ${confirm.name}?` : ""}
                confirmLabel="Desativar"
                loading={deactivate.isPending}
            />
        </div>
    )
}