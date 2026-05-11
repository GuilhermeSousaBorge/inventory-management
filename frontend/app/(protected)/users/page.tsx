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
import {
    useDeactivateUser,
    useReactivateUser,
    useUsers,
    type User,
} from "@/lib/users"
import { Pencil, Plus, Power, RotateCcw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { UserDialog } from "./user-dialog"

export default function UsersPage() {
    const { user: me } = useAuth()
    const [page, setPage] = useState(0)
    const size = 20
    const usersQuery = useUsers(page, size)

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<User | null>(null)

    const [confirm, setConfirm] = useState<{ user: User; action: "deactivate" | "reactivate" } | null>(null)
    const deactivate = useDeactivateUser()
    const reactivate = useReactivateUser()

    if (me?.role !== "OWNER") {
        return <NoAccess />
    }

    const data = usersQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    async function onConfirm() {
        if (!confirm) return
        try {
            if (confirm.action === "deactivate") {
                await deactivate.mutateAsync(confirm.user.id)
                toast.success("Usuário desativado")
            } else {
                await reactivate.mutateAsync({
                    id: confirm.user.id,
                    input: {
                        name: confirm.user.name,
                        email: confirm.user.email,
                        role: confirm.user.role,
                        active: true,
                    },
                })
                toast.success("Usuário reativado")
            }
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao alterar status")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Usuários</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Gerencie quem tem acesso ao sistema.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditing(null)
                        setDialogOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" /> Novo usuário
                </Button>
            </header>

            {usersQuery.isLoading ? (
                <SkeletonRows />
            ) : usersQuery.isError ? (
                <ErrorBanner onRetry={() => usersQuery.refetch()} />
            ) : data && data.data.length === 0 ? (
                <EmptyState
                    onCreate={() => {
                        setEditing(null)
                        setDialogOpen(true)
                    }}
                />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Perfil</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-px text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell>{u.name}</TableCell>
                                <TableCell className="max-w-[260px] truncate">{u.email}</TableCell>
                                <TableCell>
                                    <Badge variant={u.role === "OWNER" ? "default" : "outline"}>
                                        {u.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={u.active ? "default" : "outline"}>
                                        {u.active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
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
                                        {u.id === me.id ? null : u.active ? (
                                            <button
                                                type="button"
                                                onClick={() => setConfirm({ user: u, action: "deactivate" })}
                                                className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                aria-label={`Desativar ${u.name}`}
                                            >
                                                <Power className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setConfirm({ user: u, action: "reactivate" })}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5"
                                                aria-label={`Reativar ${u.name}`}
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </TableCell>
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

            <UserDialog open={dialogOpen} onClose={() => setDialogOpen(false)} user={editing} />

            <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirm?.action === "deactivate" ? "Desativar usuário" : "Reativar usuário"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirm?.action === "deactivate"
                                ? `Confirma desativar ${confirm.user.name}? Ele perderá acesso ao sistema.`
                                : `Confirma reativar ${confirm?.user.name}?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deactivate.isPending || reactivate.isPending}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onConfirm}
                            disabled={deactivate.isPending || reactivate.isPending}
                            className={
                                confirm?.action === "deactivate"
                                    ? "bg-destructive text-white hover:bg-destructive/90"
                                    : undefined
                            }
                        >
                            {deactivate.isPending || reactivate.isPending
                                ? "Processando..."
                                : confirm?.action === "deactivate"
                                  ? "Desativar"
                                  : "Reativar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function SkeletonRows() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
            ))}
        </div>
    )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
            <p className="text-sm text-text-secondary">Nenhum usuário cadastrado.</p>
            <Button className="mt-4" onClick={onCreate}>
                Criar primeiro usuário
            </Button>
        </div>
    )
}

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
            <p className="text-sm text-danger">Falha ao carregar usuários.</p>
            <Button variant="ghost" size="sm" onClick={onRetry}>
                Tentar novamente
            </Button>
        </div>
    )
}

function NoAccess() {
    return (
        <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Sem permissão</h2>
            <p className="mt-2 text-sm text-text-secondary">
                Apenas o proprietário pode gerenciar usuários.
            </p>
        </div>
    )
}