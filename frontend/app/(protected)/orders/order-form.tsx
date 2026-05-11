"use client"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
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
import { useFieldArray, useForm, useWatch } from "react-hook-form"
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
        <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <section className="space-y-4 rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Dados do pedido</h2>

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
                                <FormField
                                    control={form.control}
                                    name={`items.${i}.productId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Produto</FormLabel>
                                            <Select
                                                value={field.value || ""}
                                                onValueChange={field.onChange}
                                                disabled={products.isPending}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {products.data?.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.name} {p.size} — R$ {p.price.toFixed(2)}
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
                                                    step="1"
                                                    min="1"
                                                    {...field}
                                                    value={field.value ?? 0}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="space-y-1">
                                    <label className="text-sm font-medium leading-none">Preço</label>
                                    <Input
                                        readOnly
                                        value={`R$ ${price.toFixed(2)}`}
                                    />
                                </div>
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
        </Form>
    )
}
