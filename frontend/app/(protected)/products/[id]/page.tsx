"use client"

import { ConfirmDialog } from "@/components/overlays/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { isApiError, useAuth } from "@/lib/auth"
import { useDeactivateProduct, useProduct } from "@/lib/products"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function ProductDetailPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id ?? ""
    const router = useRouter()
    const { user } = useAuth()
    const isOwner = user?.role === "OWNER"

    const query = useProduct(id)
    const deactivate = useDeactivateProduct()

    const [confirmOpen, setConfirmOpen] = useState(false)

    if (query.isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-text-primary/5" />
                ))}
            </div>
        )
    }
    if (query.isError) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
                <p className="text-sm text-danger">Não foi possível carregar o produto.</p>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
                        Tentar novamente
                    </Button>
                    <Link href="/products">
                        <Button variant="ghost" size="sm">
                            Voltar
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const p = query.data!
    const canAct = isOwner && p.active

    async function onConfirmDeactivate() {
        try {
            await deactivate.mutateAsync(p.id)
            toast.success("Produto desativado")
            setConfirmOpen(false)
            router.replace("/products")
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao desativar produto")
        }
    }

    return (
        <div className="space-y-6">
            <nav className="text-sm text-text-secondary">
                <Link href="/products" className="hover:underline">
                    Produtos
                </Link>{" "}
                ›{" "}
                <span className="text-text-primary">
                    {p.name} {p.size}
                </span>
            </nav>

            <header className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-text-primary">
                        {p.name} {p.size}
                    </h1>
                    <Badge variant={p.active ? "success" : "neutral"}>
                        {p.active ? "Ativo" : "Inativo"}
                    </Badge>
                </div>
                {canAct ? (
                    <div className="flex gap-2">
                        <Link href={`/products/${p.id}/editar`}>
                            <Button variant="ghost">Editar</Button>
                        </Link>
                        <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
                            Desativar
                        </Button>
                    </div>
                ) : null}
            </header>

            <section className="grid gap-3 rounded-xl border border-border/40 bg-white p-5 sm:grid-cols-2">
                <div>
                    <p className="text-xs text-text-secondary">Nome</p>
                    <p className="text-sm text-text-primary">{p.name}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Tamanho</p>
                    <p className="text-sm text-text-primary">{p.size}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Categoria</p>
                    <p className="text-sm text-text-primary">{p.categoryName ?? "—"}</p>
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Preço</p>
                    <p className="text-sm text-text-primary">R$ {p.price.toFixed(2)}</p>
                </div>
                {p.description ? (
                    <div className="sm:col-span-2">
                        <p className="text-xs text-text-secondary">Descrição</p>
                        <p className="text-sm text-text-primary">{p.description}</p>
                    </div>
                ) : null}
                <div>
                    <p className="text-xs text-text-secondary">Criado em</p>
                    <p className="text-sm text-text-primary">
                        {new Date(p.createdAt).toLocaleString("pt-BR")}
                    </p>
                </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Ficha técnica</h2>
                <Table>
                    <THead>
                        <TR>
                            <TH>Ingrediente</TH>
                            <TH>Quantidade</TH>
                            <TH>Unidade</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {(p.ingredients ?? []).map((i) => (
                            <TR key={i.id}>
                                <TD>{i.ingredientName}</TD>
                                <TD>{i.quantity}</TD>
                                <TD>{i.unitOfMeasure}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </section>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={onConfirmDeactivate}
                title="Desativar produto"
                message={`Tem certeza que deseja desativar "${p.name} ${p.size}"?`}
                confirmLabel="Desativar"
                confirmVariant="danger"
                loading={deactivate.isPending}
            />
        </div>
    )
}
