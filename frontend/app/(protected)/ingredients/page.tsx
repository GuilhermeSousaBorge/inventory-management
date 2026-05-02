"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useAllCategories } from "@/lib/categories"
import {
    useDeactivateIngredient,
    useIngredients,
    type Ingredient,
} from "@/lib/ingredients"
import { useActiveSuppliers } from "@/lib/suppliers"
import { Pencil, Plus, Power } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { toast } from "sonner"

function parseActive(v: string | null): boolean | undefined {
    if (v === "true") return true
    if (v === "false") return false
    return undefined
}

function IngredientsPageInner() {
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"
    const router = useRouter()
    const searchParams = useSearchParams()

    const categoryParam = searchParams.get("category") ?? ""
    const activeParam = searchParams.get("active")
    const activeFilter =
        activeParam === null ? true : parseActive(activeParam)

    const [page, setPage] = useState(0)
    const size = 20

    const ingredientsQuery = useIngredients({
        category: categoryParam || undefined,
        active: activeFilter,
        page,
        size,
    })

    const categories = useAllCategories()
    const suppliers = useActiveSuppliers()

    const categoryNameById = useMemo(() => {
        const m = new Map<string, string>()
        categories.data?.forEach((c) => m.set(c.id, c.name))
        return m
    }, [categories.data])

    const supplierNameById = useMemo(() => {
        const m = new Map<string, string>()
        suppliers.data?.forEach((s) => m.set(s.id, s.name))
        return m
    }, [suppliers.data])

    const [confirm, setConfirm] = useState<Ingredient | null>(null)
    const deactivate = useDeactivateIngredient()

    const data = ingredientsQuery.data
    const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1

    function setFilter(key: "category" | "active", value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "" && key === "active") {
            params.delete("active")
        } else if (value === "") {
            params.delete(key)
        } else {
            params.set(key, value)
        }
        setPage(0)
        router.replace(`/ingredients?${params.toString()}`)
    }

    async function onConfirm() {
        if (!confirm) return
        try {
            await deactivate.mutateAsync(confirm.id)
            toast.success("Ingrediente desativado")
            setConfirm(null)
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar ingrediente")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Ingredientes</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Insumos controlados no estoque.
                    </p>
                </div>
                {isOwner ? (
                    <Link href="/ingredients/novo">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Novo ingrediente
                        </Button>
                    </Link>
                ) : null}
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <Field label="Categoria" htmlFor="filter-category">
                    <Select
                        id="filter-category"
                        value={categoryParam}
                        onChange={(e) => setFilter("category", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {categories.data?.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Status" htmlFor="filter-status">
                    <Select
                        id="filter-status"
                        value={activeParam ?? "true"}
                        onChange={(e) => setFilter("active", e.target.value)}
                    >
                        <option value="true">Ativos</option>
                        <option value="false">Inativos</option>
                        <option value="">Todos</option>
                    </Select>
                </Field>
            </div>

            {ingredientsQuery.isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-text-primary/5" />
                    ))}
                </div>
            ) : ingredientsQuery.isError ? (
                <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                    <p className="text-sm text-danger">Falha ao carregar ingredientes.</p>
                    <Button variant="ghost" size="sm" onClick={() => ingredientsQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data && data.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-white p-10 text-center">
                    <p className="text-sm text-text-secondary">Nenhum ingrediente cadastrado.</p>
                    {isOwner ? (
                        <Link href="/ingredients/novo">
                            <Button className="mt-4">Criar primeiro ingrediente</Button>
                        </Link>
                    ) : null}
                </div>
            ) : (
                <Table>
                    <THead>
                        <TR>
                            <TH>Nome</TH>
                            <TH>Categoria</TH>
                            <TH>Mínimo</TH>
                            <TH>Fornecedor padrão</TH>
                            <TH>Status</TH>
                            {isOwner ? <TH className="w-px text-right">Ações</TH> : null}
                        </TR>
                    </THead>
                    <TBody>
                        {data!.data.map((ing) => (
                            <TR key={ing.id}>
                                <TD>{ing.name}</TD>
                                <TD>{categoryNameById.get(ing.categoryId) ?? "—"}</TD>
                                <TD>
                                    {ing.minimumQty} {ing.unitOfMeasure}
                                </TD>
                                <TD>
                                    {ing.defaultSupplierId
                                        ? supplierNameById.get(ing.defaultSupplierId) ?? "—"
                                        : "—"}
                                </TD>
                                <TD>
                                    <Badge variant={ing.active ? "success" : "neutral"}>
                                        {ing.active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TD>
                                {isOwner ? (
                                    <TD className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Link
                                                href={`/ingredients/${ing.id}/editar`}
                                                className="rounded p-1.5 text-text-primary/70 hover:bg-text-primary/5 hover:text-text-primary"
                                                aria-label={`Editar ${ing.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Link>
                                            {ing.active ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirm(ing)}
                                                    className="rounded p-1.5 text-danger/80 hover:bg-danger/10"
                                                    aria-label={`Desativar ${ing.name}`}
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

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={onConfirm}
                title="Desativar ingrediente"
                message={confirm ? `Confirma desativar ${confirm.name}?` : ""}
                confirmLabel="Desativar"
                confirmVariant="danger"
                loading={deactivate.isPending}
            />
        </div>
    )
}

export default function IngredientsPage() {
    return (
        <Suspense fallback={null}>
            <IngredientsPageInner />
        </Suspense>
    )
}
