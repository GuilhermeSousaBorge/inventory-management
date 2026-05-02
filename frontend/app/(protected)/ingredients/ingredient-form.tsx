"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { isApiError } from "@/lib/auth"
import { useAllCategories } from "@/lib/categories"
import {
    createIngredientSchema,
    updateIngredientSchema,
    UNITS_OF_MEASURE,
    useCreateIngredient,
    useUpdateIngredient,
    type CreateIngredientInput,
    type Ingredient,
    type UpdateIngredientInput,
} from "@/lib/ingredients"
import { useActiveSuppliers } from "@/lib/suppliers"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    mode: "create" | "edit"
    initial?: Ingredient
}

export function IngredientForm({ mode, initial }: Props) {
    const router = useRouter()
    const categories = useAllCategories()
    const suppliers = useActiveSuppliers()
    const create = useCreateIngredient()
    const update = useUpdateIngredient()

    const form = useForm<UpdateIngredientInput>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(mode === "edit" ? updateIngredientSchema : createIngredientSchema) as any,
        defaultValues:
            mode === "edit" && initial
                ? {
                      name: initial.name,
                      description: initial.description ?? "",
                      categoryId: initial.categoryId,
                      unitOfMeasure: initial.unitOfMeasure,
                      minimumQty: initial.minimumQty,
                      expiryDate: initial.expiryDate ?? "",
                      defaultSupplierId: initial.defaultSupplierId ?? "",
                      active: initial.active,
                  }
                : {
                      name: "",
                      description: "",
                      categoryId: "",
                      unitOfMeasure: "kg",
                      minimumQty: 0,
                      expiryDate: "",
                      defaultSupplierId: "",
                  },
    })

    async function onSubmit(values: UpdateIngredientInput) {
        try {
            if (mode === "edit" && initial) {
                await update.mutateAsync({ id: initial.id, input: values as UpdateIngredientInput })
                toast.success("Ingrediente atualizado")
            } else {
                await create.mutateAsync(values as CreateIngredientInput)
                toast.success("Ingrediente criado")
            }
            router.replace("/ingredients")
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar ingrediente")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Field
                label="Nome"
                htmlFor="ingredient-name"
                error={form.formState.errors.name?.message}
            >
                <Input id="ingredient-name" {...form.register("name")} />
            </Field>

            <Field
                label="Descrição"
                htmlFor="ingredient-description"
                error={form.formState.errors.description?.message}
            >
                <Input id="ingredient-description" {...form.register("description")} />
            </Field>

            <Field
                label="Categoria"
                htmlFor="ingredient-category"
                error={form.formState.errors.categoryId?.message}
            >
                <Select id="ingredient-category" {...form.register("categoryId")}>
                    <option value="">Selecione...</option>
                    {categories.data?.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </Select>
            </Field>

            <Field
                label="Unidade de medida"
                htmlFor="ingredient-unit"
                error={form.formState.errors.unitOfMeasure?.message}
            >
                <Select id="ingredient-unit" {...form.register("unitOfMeasure")}>
                    {UNITS_OF_MEASURE.map((u) => (
                        <option key={u} value={u}>
                            {u}
                        </option>
                    ))}
                </Select>
            </Field>

            <Field
                label="Quantidade mínima"
                htmlFor="ingredient-min"
                error={form.formState.errors.minimumQty?.message}
            >
                <Input
                    id="ingredient-min"
                    type="number"
                    step="0.001"
                    min="0"
                    {...form.register("minimumQty")}
                />
            </Field>

            <Field
                label="Validade"
                htmlFor="ingredient-expiry"
                error={form.formState.errors.expiryDate?.message}
            >
                <Input
                    id="ingredient-expiry"
                    type="date"
                    {...form.register("expiryDate")}
                />
            </Field>

            <Field
                label="Fornecedor padrão"
                htmlFor="ingredient-supplier"
                error={form.formState.errors.defaultSupplierId?.message}
            >
                <Select id="ingredient-supplier" {...form.register("defaultSupplierId")}>
                    <option value="">Nenhum</option>
                    {suppliers.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </Select>
            </Field>

            {mode === "edit" ? (
                <label className="flex items-center gap-2 text-sm text-text-primary">
                    <input type="checkbox" {...form.register("active")} />
                    Ativo
                </label>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.replace("/ingredients")}
                    disabled={submitting}
                >
                    Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                    {submitting ? "Salvando..." : "Salvar"}
                </Button>
            </div>
        </form>
    )
}
