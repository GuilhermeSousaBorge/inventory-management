"use client"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isApiError } from "@/lib/auth"
import { useAllIngredients } from "@/lib/ingredients"
import {
    createPurchaseOrderSchema,
    updatePurchaseOrderSchema,
    useCreatePurchaseOrder,
    useUpdatePurchaseOrder,
    type CreatePurchaseOrderInput,
    type PurchaseOrder,
    type UpdatePurchaseOrderInput,
} from "@/lib/purchase-orders"
import { useActiveSuppliers } from "@/lib/suppliers"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    mode: "create" | "edit"
    initial?: PurchaseOrder
}

export function PurchaseOrderForm({ mode, initial }: Props) {
    const router = useRouter()
    const suppliers = useActiveSuppliers()
    const units = useAllUnits()
    const ingredients = useAllIngredients()
    const create = useCreatePurchaseOrder()
    const update = useUpdatePurchaseOrder()

    const form = useForm<CreatePurchaseOrderInput>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(
            mode === "edit" ? updatePurchaseOrderSchema : createPurchaseOrderSchema
        ) as any,
        defaultValues:
            mode === "edit" && initial
                ? {
                      supplierId: initial.supplierId,
                      unitId: initial.unitId,
                      expectedAt: initial.expectedAt ?? "",
                      notes: initial.notes ?? "",
                      items: initial.items.map((i) => ({
                          ingredientId: i.ingredientId,
                          quantity: i.quantity,
                          unitPrice: i.unitPrice,
                      })),
                  }
                : {
                      supplierId: "",
                      unitId: "",
                      expectedAt: "",
                      notes: "",
                      items: [{ ingredientId: "", quantity: 0, unitPrice: 0 }],
                  },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const watchedItems = useWatch({ control: form.control, name: "items" }) ?? []

    const total = watchedItems.reduce(
        (acc: number, it) => acc + (Number(it?.quantity) || 0) * (Number(it?.unitPrice) || 0),
        0
    )

    function onIngredientChange(index: number, ingredientId: string) {
        form.setValue(`items.${index}.ingredientId`, ingredientId, { shouldDirty: true })
        const currentPrice = form.getValues(`items.${index}.unitPrice`)
        if (!currentPrice || Number(currentPrice) === 0) {
            const ing = ingredients.data?.find((i) => i.id === ingredientId)
            if (ing) form.setValue(`items.${index}.unitPrice`, ing.averageCost)
        }
    }

    async function onSubmit(values: CreatePurchaseOrderInput) {
        try {
            if (mode === "edit" && initial) {
                const updated = await update.mutateAsync({
                    id: initial.id,
                    input: values as UpdatePurchaseOrderInput,
                })
                toast.success("Compra atualizada")
                router.replace(`/purchase-orders/${updated.id}`)
            } else {
                const created = await create.mutateAsync(values)
                toast.success("Compra criada")
                router.replace(`/purchase-orders/${created.id}`)
            }
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar compra")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
                <section className="space-y-4 rounded-xl border border-border/40 bg-white p-5">
                    <h2 className="text-base font-semibold text-foreground">Dados da compra</h2>

                    <FormField
                        control={form.control}
                        name="supplierId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fornecedor</FormLabel>
                                <Select
                                    value={field.value || ""}
                                    onValueChange={field.onChange}
                                    disabled={suppliers.isPending}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={suppliers.isPending ? "Carregando..." : "Selecione..."} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {suppliers.data?.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
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
                        name="unitId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unidade</FormLabel>
                                <Select
                                    value={field.value || ""}
                                    onValueChange={field.onChange}
                                    disabled={units.isPending}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={units.isPending ? "Carregando..." : "Selecione..."} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {units.data?.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.name}
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
                        name="expectedAt"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data esperada</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Observações</FormLabel>
                                <FormControl>
                                    <Input {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </section>

                <section className="space-y-4 rounded-xl border border-border/40 bg-white p-5" data-testid="po-items">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-foreground">Itens</h2>
                        {form.formState.errors.items?.message ? (
                            <span className="text-sm text-destructive">{form.formState.errors.items.message}</span>
                        ) : null}
                    </div>

                    <div className="space-y-3">
                        {fields.map((f, i) => {
                            const qty = Number(watchedItems[i]?.quantity) || 0
                            const price = Number(watchedItems[i]?.unitPrice) || 0
                            const subtotal = qty * price
                            return (
                                <div
                                    key={f.id}
                                    data-testid="po-item-row"
                                    className="grid grid-cols-[1fr_120px_140px_120px_auto] items-end gap-3"
                                >
                                    <FormField
                                        control={form.control}
                                        name={`items.${i}.ingredientId`}
                                        render={() => (
                                            <FormItem>
                                                <FormLabel>Ingrediente</FormLabel>
                                                <Select
                                                    value={watchedItems[i]?.ingredientId || ""}
                                                    onValueChange={(v) => onIngredientChange(i, v)}
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
                                        name={`items.${i}.quantity`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quantidade</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.001"
                                                        min="0"
                                                        {...field}
                                                        value={field.value ?? 0}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`items.${i}.unitPrice`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Preço unit.</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.0001"
                                                        min="0"
                                                        {...field}
                                                        value={field.value ?? 0}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium leading-none">Subtotal</label>
                                        <Input
                                            readOnly
                                            value={`R$ ${subtotal.toFixed(2)}`}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label="Remover item"
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
                        onClick={() => append({ ingredientId: "", quantity: 0, unitPrice: 0 })}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Adicionar item
                    </Button>

                    <div className="flex justify-end border-t border-border/40 pt-3 text-sm font-medium">
                        Total: <span data-testid="po-total" className="ml-2">R$ {total.toFixed(2)}</span>
                    </div>
                </section>

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={submitting}
                        onClick={() =>
                            router.replace(
                                mode === "edit" && initial
                                    ? `/purchase-orders/${initial.id}`
                                    : "/purchase-orders"
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
