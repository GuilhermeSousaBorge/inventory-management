"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useProduct } from "@/lib/products"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ProductForm } from "../../product-form"

export default function EditProductPage() {
    const params = useParams<{ id: string }>()
    const id = params?.id ?? ""
    const { user } = useAuth()
    const query = useProduct(id)

    if (!user) return null
    if (user.role !== "OWNER") {
        return (
            <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
                <p className="text-sm text-muted-foreground">
                    Você não tem permissão para editar produtos.
                </p>
            </div>
        )
    }

    if (query.isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-foreground/5" />
                ))}
            </div>
        )
    }
    if (query.isError) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">Não foi possível carregar o produto.</p>
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

    const product = query.data!

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <nav className="text-sm text-muted-foreground">
                <Link href="/products" className="hover:underline">
                    Produtos
                </Link>{" "}
                ›{" "}
                <span className="text-foreground">
                    Editar {product.name} {product.size}
                </span>
            </nav>
            <h1 className="text-2xl font-semibold text-foreground">Editar produto</h1>
            <ProductForm mode="edit" initial={product} />
        </div>
    )
}
