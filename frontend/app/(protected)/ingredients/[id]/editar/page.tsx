"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useIngredient } from "@/lib/ingredients"
import Link from "next/link"
import { useParams } from "next/navigation"
import { IngredientForm } from "../../ingredient-form"

export default function EditIngredientPage() {
    const { user } = useAuth()
    const params = useParams<{ id: string }>()
    const id = params.id
    const ingredientQuery = useIngredient(user?.role === "OWNER" ? id : "")

    if (user?.role !== "OWNER") return <NoAccess />

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-text-secondary">
                    <Link href="/ingredients" className="hover:underline">
                        Ingredientes
                    </Link>{" "}
                    › Editar
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-text-primary">Editar ingrediente</h1>
            </header>

            <div className="mx-auto max-w-2xl rounded-xl border border-border/40 bg-white p-6">
                {ingredientQuery.isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-10 animate-pulse rounded-lg bg-text-primary/5" />
                        ))}
                    </div>
                ) : ingredientQuery.isError ? (
                    <div className="text-center">
                        <p className="text-sm text-danger">Não foi possível carregar o ingrediente.</p>
                        <div className="mt-3 flex items-center justify-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => ingredientQuery.refetch()}
                            >
                                Tentar novamente
                            </Button>
                            <Link href="/ingredients">
                                <Button variant="ghost" size="sm">
                                    Voltar
                                </Button>
                            </Link>
                        </div>
                    </div>
                ) : ingredientQuery.data ? (
                    <IngredientForm mode="edit" initial={ingredientQuery.data} />
                ) : null}
            </div>
        </div>
    )
}

function NoAccess() {
    return (
        <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Sem permissão</h2>
            <p className="mt-2 text-sm text-text-secondary">
                Apenas o proprietário pode editar ingredientes.
            </p>
        </div>
    )
}
