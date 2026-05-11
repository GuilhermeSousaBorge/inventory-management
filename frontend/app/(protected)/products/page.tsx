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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useAllCategories } from "@/lib/categories"
import {
    PRODUCT_SIZES,
    useDeactivateProduct,
    useProducts,
    type ProductSize,
} from "@/lib/products"
import { Eye, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { toast } from "sonner"

function ProductsPageInner() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const router = useRouter()
    const searchParams = useSearchParams()

    const categoryParam = searchParams.get("category") ?? ""
    const sizeParamRaw = searchParams.get("size")
    const sizeParam: ProductSize | undefined =
        sizeParamRaw && PRODUCT_SIZES.includes(sizeParamRaw as ProductSize)
            ? (sizeParamRaw as ProductSize)
            : undefined
    const activeParamRaw = searchParams.get("active")
    // default = active=true (only when nothing in URL)
    const activeParam: boolean | undefined =
        activeParamRaw === null
            ? true
            : activeParamRaw === ""
              ? undefined
              : activeParamRaw === "true"

    const [page, setPage] = useState(0)
    const pageSize = 20

    const query = useProducts({
        category: categoryParam || undefined,
        size: sizeParam,
        active: activeParam,
        page,
        pageSize,
    })

    const categories = useAllCategories()
    const deactivate = useDeactivateProduct()

    const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null)

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "") params.set(key, "")
        else params.set(key, value)
        setPage(0)
        router.replace(`/products?${params.toString()}`)
    }

    async function handleDeactivate() {
        if (!confirmTarget) return
        try {
            await deactivate.mutateAsync(confirmTarget.id)
            toast.success("Produto desativado")
            setConfirmTarget(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar produto")
        }
    }

    const data = query.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Produtos</h1>
                    <p className="mt-1 text-sm text-text-secondary">Cardápio com fichas técnicas.</p>
                </div>
                {isOwner ? (
                    <Link href="/products/nova">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Novo produto
                        </Button>
                    </Link>
                ) : null}
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <Label htmlFor="filter-category">Categoria</Label>
                    {/* Radix Select cannot have value="" on SelectItem; use "__all" sentinel and translate at URL boundary */}
                    <Select
                        value={categoryParam || "__all"}
                        onValueChange={(v) => setFilter("category", v === "__all" ? "" : v)}
                    >
                        <SelectTrigger id="filter-category">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">Todas</SelectItem>
                            {categories.data?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="filter-size">Tamanho</Label>
                    <Select
                        value={sizeParam ?? "__all"}
                        onValueChange={(v) => setFilter("size", v === "__all" ? "" : v)}
                    >
                        <SelectTrigger id="filter-size">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">Todos</SelectItem>
                            {PRODUCT_SIZES.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="filter-active">Ativo</Label>
                    <Select
                        value={activeParamRaw === "" ? "__all" : (activeParamRaw ?? "true")}
                        onValueChange={(v) => setFilter("active", v === "__all" ? "" : v)}
                    >
                        <SelectTrigger id="filter-active">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">Sim</SelectItem>
                            <SelectItem value="false">Não</SelectItem>
                            <SelectItem value="__all">Todos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : query.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar produtos.</p>
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum produto cadastrado.</p>
                    {isOwner ? (
                        <Link href="/products/nova">
                            <Button className="mt-4">Criar primeiro produto</Button>
                        </Link>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tamanho</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-px text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data!.data.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{p.size}</Badge>
                                </TableCell>
                                <TableCell>{p.categoryName ?? "—"}</TableCell>
                                <TableCell>R$ {p.price.toFixed(2)}</TableCell>
                                <TableCell>
                                    <Badge variant={p.active ? "default" : "outline"}>
                                        {p.active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Link
                                            href={`/products/${p.id}`}
                                            className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                            aria-label={`Ver produto ${p.name} ${p.size}`}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                        {isOwner ? (
                                            <>
                                                <Link
                                                    href={`/products/${p.id}/editar`}
                                                    className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                    aria-label={`Editar ${p.name} ${p.size}`}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Link>
                                                {p.active ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirmTarget({
                                                                id: p.id,
                                                                name: `${p.name} ${p.size}`,
                                                            })
                                                        }
                                                        className="rounded p-1.5 text-text-primary/70 hover:bg-danger/10 hover:text-danger"
                                                        aria-label={`Desativar ${p.name} ${p.size}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                ) : null}
                                            </>
                                        ) : null}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {data && data.total > pageSize ? (
                <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>
                        Página {page + 1} de {totalPages} · {pageSize} por página
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

            <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desativar produto</AlertDialogTitle>
                        <AlertDialogDescription>
                            {`Tem certeza que deseja desativar "${confirmTarget?.name ?? ""}"? Ele deixará de aparecer no cardápio.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deactivate.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeactivate}
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

export default function ProductsPage() {
    return (
        <Suspense fallback={null}>
            <ProductsPageInner />
        </Suspense>
    )
}
