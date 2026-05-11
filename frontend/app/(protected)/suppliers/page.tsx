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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useDeactivateSupplier, useSuppliers, type Supplier } from "@/lib/suppliers"
import { Pencil, Plus, Power } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { SupplierDialog } from "./supplier-dialog"

export default function SuppliersPage() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const [page, setPage] = useState(0)
    const size = 20
    const suppliersQuery = useSuppliers({ page, size })

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Supplier | null>(null)
    const [confirm, setConfirm] = useState<Supplier | null>(null)
    const deactivate = useDeactivateSupplier()

    const data = suppliersQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    async function onConfirm() {
        if (!confirm) return
        try {
            await deactivate.mutateAsync(confirm.id)
            toast.success("Fornecedor desativado")
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar fornecedor")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Fornecedores</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Quem fornece os ingredientes da pizzaria.
                    </p>
                </div>
                {isOwner ? (
                    <Button
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Novo fornecedor
                    </Button>
                ) : null}
            </header>

            {suppliersQuery.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : suppliersQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar fornecedores.</p>
                    <Button variant="ghost" size="sm" onClick={() => suppliersQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum fornecedor cadastrado.</p>
                    {isOwner ? (
                        <Button
                            className="mt-4"
                            onClick={() => {
                                setEditing(null)
                                setDialogOpen(true)
                            }}
                        >
                            Criar primeiro fornecedor
                        </Button>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Status</TableHead>
                            {isOwner ? <TableHead className="w-px text-right">Ações</TableHead> : null}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell>{s.name}</TableCell>
                                <TableCell>{s.contactName ?? "—"}</TableCell>
                                <TableCell>{s.phone ?? "—"}</TableCell>
                                <TableCell>
                                    <Badge variant={s.active ? "default" : "outline"}>
                                        {s.active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                {isOwner ? (
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditing(s)
                                                    setDialogOpen(true)
                                                }}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar ${s.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            {s.active ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirm(s)}
                                                    className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                    aria-label={`Desativar ${s.name}`}
                                                >
                                                    <Power className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                ) : null}
                            </TableRow>
                        ))}
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

            {isOwner ? (
                <SupplierDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    supplier={editing}
                />
            ) : null}

            <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desativar fornecedor</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirm ? `Confirma desativar ${confirm.name}?` : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deactivate.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onConfirm}
                            disabled={deactivate.isPending}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {deactivate.isPending ? "Processando..." : "Desativar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
