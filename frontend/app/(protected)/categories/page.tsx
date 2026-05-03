"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useCategories, useDeleteCategory, type Category } from "@/lib/categories"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { CategoryDialog } from "./category-dialog"

export default function CategoriesPage() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const [page, setPage] = useState(0)
    const size = 20
    const categoriesQuery = useCategories(page, size)

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)
    const [confirm, setConfirm] = useState<Category | null>(null)
    const remove = useDeleteCategory()

    const data = categoriesQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    async function onConfirm() {
        if (!confirm) return
        try {
            await remove.mutateAsync(confirm.id)
            toast.success("Categoria removida")
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) {
                if (err.status === 409 || err.status === 400) {
                    toast.error("Não é possível remover: existem ingredientes nesta categoria.")
                } else {
                    toast.error(err.message)
                }
            } else {
                toast.error("Erro ao remover categoria")
            }
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Categorias</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Agrupamentos para os ingredientes da pizzaria.
                    </p>
                </div>
                {isOwner ? (
                    <Button
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Nova categoria
                    </Button>
                ) : null}
            </header>

            {categoriesQuery.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : categoriesQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar categorias.</p>
                    <Button variant="ghost" size="sm" onClick={() => categoriesQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhuma categoria cadastrada.</p>
                    {isOwner ? (
                        <Button
                            className="mt-4"
                            onClick={() => {
                                setEditing(null)
                                setDialogOpen(true)
                            }}
                        >
                            Criar primeira categoria
                        </Button>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>Descrição</TH>
                            {isOwner ? <TH className="w-px text-right">Ações</TH> : null}
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((c) => (
                            <TR key={c.id}>
                                <TD>{c.name}</TD>
                                <TD className="max-w-[420px] truncate">{c.description ?? "—"}</TD>
                                {isOwner ? (
                                    <TD className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(c)
                                                    setDialogOpen(true)
                                                }}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar ${c.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirm(c)}
                                                className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                aria-label={`Remover ${c.name}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
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
                <CategoryDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    category={editing}
                />
            ) : null}

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={onConfirm}
                title="Remover categoria"
                message={confirm ? `Confirma remover ${confirm.name}? Esta ação não pode ser desfeita.` : ""}
                confirmLabel="Remover"
                confirmVariant="danger"
                loading={remove.isPending}
            />
        </div>
    )
}
