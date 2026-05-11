"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
                    <h1 className="text-2xl font-semibold text-foreground">Categorias</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
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
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-foreground/5" />
                    ))}
                </div>
            ) : categoriesQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <p className="text-sm text-destructive">Falha ao carregar categorias.</p>
                    <Button variant="ghost" size="sm" onClick={() => categoriesQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
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
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Descrição</TableHead>
                            {isOwner ? <TableHead className="w-px text-right">Ações</TableHead> : null}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell>{c.name}</TableCell>
                                <TableCell className="max-w-[420px] truncate">{c.description ?? "—"}</TableCell>
                                {isOwner ? (
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(c)
                                                    setDialogOpen(true)
                                                }}
                                                className="rounded p-1.5 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                                                aria-label={`Editar ${c.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirm(c)}
                                                className="rounded p-1.5 text-destructive/80 hover:bg-destructive/10"
                                                aria-label={`Remover ${c.name}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </TableCell>
                                ) : null}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {data && data.total > size ? (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
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

            <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover categoria</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirm ? `Confirma remover ${confirm.name}? Esta ação não pode ser desfeita.` : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onConfirm}
                            disabled={remove.isPending}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {remove.isPending ? "Processando..." : "Remover"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
