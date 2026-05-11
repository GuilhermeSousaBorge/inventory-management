"use client"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isApiError } from "@/lib/auth"
import { useAllCategories } from "@/lib/categories"
import { useAllIngredients } from "@/lib/ingredients"
import {
    PRODUCT_SIZES,
    createProductSchema,
    updateProductSchema,
    useCreateProduct,
    useUpdateProduct,
    type CreateProductInput,
    type Product,
    type UpdateProductInput,
} from "@/lib/products"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    mode: "create" | "edit"
    initial?: Product
}

export function ProductForm({ mode, initial }: Props) {
    const router = useRouter()
    const ingredients = useAllIngredients()
    const categories = useAllCategories()
    const create = useCreateProduct()
    const update = useUpdateProduct()

    const form = useForm<CreateProductInput>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(
            mode === "edit" ? updateProductSchema : createProductSchema
        ) as any,
        defaultValues:
            mode === "edit" && initial
                ? {
                      name: initial.name,
                      size: initial.size,
                      categoryId: initial.categoryId ?? "",
                      price: initial.price,
                      description: initial.description ?? "",
                      ingredients: (initial.ingredients ?? []).length
                          ? initial.ingredients.map((i) => ({
                                ingredientId: i.ingredientId,
                                quantity: i.quantity,
                            }))
                          : [{ ingredientId: "", quantity: 0 }],
                  }
                : {
                      name: "",
                      size: "G",
                      categoryId: "",
                      price: 0,
                      description: "",
                      ingredients: [{ ingredientId: "", quantity: 0 }],
                  },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "ingredients",
    })

    const watchedIngredients = useWatch({ control: form.control, name: "ingredients" }) ?? []

    function ingredientUnit(ingredientId: string): string {
        const ing = ingredients.data?.find((i) => i.id === ingredientId)
        return ing?.unitOfMeasure ?? "—"
    }

    async function onSubmit(values: CreateProductInput) {
        try {
            if (mode === "edit" && initial) {
                const updated = await update.mutateAsync({
                    id: initial.id,
                    input: values as UpdateProductInput,
                })
                toast.success("Produto atualizado")
                router.replace(`/products/${updated.id}`)
            } else {
                const created = await create.mutateAsync(values)
                toast.success("Produto criado")
                router.replace(`/products/${created.id}`)
            }
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar produto")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <section className="space-y-4 rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-foreground">Dados do produto</h2>

                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="size"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tamanho</FormLabel>
                                <Select value={field.value || ""} onValueChange={field.onChange}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {PRODUCT_SIZES.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Categoria</FormLabel>
                                <Select
                                    value={field.value || "__none"}
                                    onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                                    disabled={categories.isPending}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sem categoria" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="__none">Sem categoria</SelectItem>
                                        {categories.data?.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Preço (R$)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" min="0.01" {...field} value={field.value ?? 0} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl>
                                <Input {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </section>

            <section
                className="space-y-4 rounded-xl border border-border/40 bg-white p-5"
                data-testid="prod-ingredients"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">Ficha técnica</h2>
                    {(form.formState.errors.ingredients?.message ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (form.formState.errors.ingredients as any)?.root?.message) ? (
                        <span className="text-sm text-destructive">
                            {form.formState.errors.ingredients?.message ||
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (form.formState.errors.ingredients as any)?.root?.message}
                        </span>
                    ) : null}
                </div>

                <div className="space-y-3">
                    {fields.map((f, i) => {
                        const ingredientId = watchedIngredients[i]?.ingredientId ?? ""
                        return (
                            <div
                                key={f.id}
                                data-testid="prod-ingredient-row"
                                className="grid grid-cols-[1fr_120px_80px_auto] items-end gap-3"
                            >
                                <FormField
                                    control={form.control}
                                    name={`ingredients.${i}.ingredientId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ingrediente</FormLabel>
                                            <Select
                                                value={field.value || ""}
                                                onValueChange={field.onChange}
                                                disabled={ingredients.isPending}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {ingredients.data?.map((ing) => (
                                                        <SelectItem key={ing.id} value={ing.id}>
                                                            {ing.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`ingredients.${i}.quantity`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Quantidade</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.001" min="0" {...field} value={field.value ?? 0} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormItem>
                                    <FormLabel>Unidade</FormLabel>
                                    <Input readOnly value={ingredientUnit(ingredientId)} />
                                </FormItem>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Remover item da ficha"
                                    disabled={fields.length === 1}
                                    onClick={() => remove(i)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    })}
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => append({ ingredientId: "", quantity: 0 })}
                >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar ingrediente
                </Button>
            </section>

            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() =>
                        router.replace(
                            mode === "edit" && initial
                                ? `/products/${initial.id}`
                                : "/products"
                        )
                    }
                >
                    Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                    {submitting ? "Salvando..." : "Salvar"}
                </Button>
            </div>
        </form>
        </Form>
    )
}
