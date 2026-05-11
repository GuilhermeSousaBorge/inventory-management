"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isApiError } from "@/lib/auth"
import {
    createOrderSchema,
    updateOrderSchema,
    useCreateOrder,
    useUpdateOrder,
    type CreateOrderInput,
    type Order,
    type UpdateOrderInput,
} from "@/lib/orders"
import { useAllProducts } from "@/lib/products"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    mode: "create" | "edit"
    initial?: Order
}

export function OrderForm({ mode, initial }: Props) {
    const router = useRouter()
    const products = useAllProducts()
    const units = useAllUnits()
    const create = useCreateOrder()
    const update = useUpdateOrder()

    const form = useForm<CreateOrderInput>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(
            mode === "edit" ? updateOrderSchema : createOrderSchema
        ) as any,
        defaultValues:
            mode === "edit" && initial
                ? {
                      unitId: initial.unitId,
                      notes: initial.notes ?? "",
                      items: (initial.items ?? []).length
                          ? initial.items.map((it) => ({
                                productId: it.productId,
                                quantity: it.quantity,
                            }))
                          : [{ productId: "", quantity: 1 }],
                  }
                : {
                      unitId: "",
                      notes: "",
                      items: [{ productId: "", quantity: 1 }],
                  },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const watchedItems = useWatch({ control: form.control, name: "items" }) ?? []

    function productPrice(productId: string): number {
        const p = products.data?.find((x) => x.id === productId)
        return p?.price ?? 0
    }

    const total = watchedItems.reduce(
        (acc: number, it) => acc + (Number(it?.quantity) || 0) * productPrice(it?.productId ?? ""),
        0,
    )

    async function onSubmit(values: CreateOrderInput) {
        try {
            if (mode === "edit" && initial) {
                const updated = await update.mutateAsync({
                    id: initial.id,
                    input: values as UpdateOrderInput,
                })
                toast.success("Pedido atualizado")
                router.replace(`/orders/${updated.id}`)
            } else {
                const created = await create.mutateAsync(values)
                toast.success("Pedido criado")
                router.replace(`/orders/${created.id}`)
            }
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar pedido")
        }
    }

    const submitting = create.isPending || update.isPending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsRootMessage =
        form.formState.errors.items?.message ??
        (form.formState.errors.items as any)?.root?.message

    return (
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <section className="space-y-4 rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Dados do pedido</h2>

                <Field
                    label="Unidade"
                    htmlFor="ord-unit"
                    error={form.formState.errors.unitId?.message}
                >
                    <Controller
                        control={form.control}
                        name="unitId"
                        render={({ field }) => (
                            <Select
                                value={field.value || ""}
                                onValueChange={field.onChange}
                                disabled={units.isPending}
                            >
                                <SelectTrigger id="ord-unit">
                                    <SelectValue placeholder={units.isPending ? "Carregando..." : "Selecione..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {units.data?.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </Field>

                <Field
                    label="Observações"
                    htmlFor="ord-notes"
                    hint="Opcional · até 500 caracteres"
                    error={form.formState.errors.notes?.message}
                >
                    <Input id="ord-notes" {...form.register("notes")} />
                </Field>
            </section>

            <section
                className="space-y-4 rounded-xl border border-border/40 bg-white p-5"
                data-testid="ord-items"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary">Itens</h2>
                    {itemsRootMessage ? (
                        <span className="text-sm text-danger">{itemsRootMessage}</span>
                    ) : null}
                </div>

                <div className="space-y-3">
                    {fields.map((f, i) => {
                        const productId = watchedItems[i]?.productId ?? ""
                        const qty = Number(watchedItems[i]?.quantity) || 0
                        const price = productPrice(productId)
                        const subtotal = qty * price
                        return (
                            <div
                                key={f.id}
                                data-testid="ord-item-row"
                                className="grid grid-cols-[1fr_100px_120px_140px_auto] items-end gap-3"
                            >
                                <Field
                                    label="Produto"
                                    htmlFor={`ord-item-prod-${i}`}
                                    error={form.formState.errors.items?.[i]?.productId?.message}
                                >
                                    <Controller
                                        control={form.control}
                                        name={`items.${i}.productId`}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value || ""}
                                                onValueChange={field.onChange}
                                                disabled={products.isPending}
                                            >
                                                <SelectTrigger id={`ord-item-prod-${i}`}>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products.data?.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.name} {p.size} — R$ {p.price.toFixed(2)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </Field>
                                <Field
                                    label="Quantidade"
                                    htmlFor={`ord-item-qty-${i}`}
                                    error={form.formState.errors.items?.[i]?.quantity?.message}
                                >
                                    <Input
                                        id={`ord-item-qty-${i}`}
                                        type="number"
                                        step="1"
                                        min="1"
                                        {...form.register(`items.${i}.quantity`)}
                                    />
                                </Field>
                                <Field label="Preço" htmlFor={`ord-item-price-${i}`}>
                                    <Input
                                        id={`ord-item-price-${i}`}
                                        readOnly
                                        value={`R$ ${price.toFixed(2)}`}
                                    />
                                </Field>
                                <Field label="Subtotal" htmlFor={`ord-item-sub-${i}`}>
                                    <Input
                                        id={`ord-item-sub-${i}`}
                                        readOnly
                                        value={`R$ ${subtotal.toFixed(2)}`}
                                    />
                                </Field>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Remover item do pedido"
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
                    onClick={() => append({ productId: "", quantity: 1 })}
                >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar item
                </Button>

                <div className="flex justify-end border-t border-border/40 pt-3 text-sm font-medium">
                    Total:{" "}
                    <span data-testid="ord-total" className="ml-2">
                        R$ {total.toFixed(2)}
                    </span>
                </div>
            </section>

            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() =>
                        router.replace(
                            mode === "edit" && initial ? `/orders/${initial.id}` : "/orders",
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
    )
}
