"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isApiError } from "@/lib/auth"
import { useAllIngredients } from "@/lib/ingredients"
import {
    ADJUSTMENT_DIRECTIONS,
    createAdjustmentSchema,
    useCreateAdjustment,
    type CreateAdjustmentInput,
} from "@/lib/stock-movements"
import { useAllUnits } from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
}

export function AdjustmentDialog({ open, onClose }: Props) {
    const ingredients = useAllIngredients()
    const units = useAllUnits()
    const create = useCreateAdjustment()

    const form = useForm<CreateAdjustmentInput>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(createAdjustmentSchema) as any,
        defaultValues: {
            ingredientId: "",
            unitId: "",
            quantity: 0,
            direction: "INCREASE",
            reason: "",
        },
    })

    async function onSubmit(values: CreateAdjustmentInput) {
        try {
            await create.mutateAsync(values)
            toast.success("Ajuste registrado")
            form.reset()
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao registrar ajuste")
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Novo ajuste de estoque"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={create.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="adjustment-form"
                        disabled={create.isPending}
                    >
                        {create.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="adjustment-form" className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
                <Field
                    label="Ingrediente"
                    htmlFor="adj-ingredient"
                    error={form.formState.errors.ingredientId?.message}
                >
                    <Controller
                        control={form.control}
                        name="ingredientId"
                        render={({ field }) => (
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                                <SelectTrigger id="adj-ingredient">
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ingredients.data?.map((i) => (
                                        <SelectItem key={i.id} value={i.id}>
                                            {i.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </Field>

                <Field
                    label="Unidade"
                    htmlFor="adj-unit"
                    error={form.formState.errors.unitId?.message}
                >
                    <Controller
                        control={form.control}
                        name="unitId"
                        render={({ field }) => (
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                                <SelectTrigger id="adj-unit">
                                    <SelectValue placeholder="Selecione..." />
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
                    label="Quantidade"
                    htmlFor="adj-qty"
                    error={form.formState.errors.quantity?.message}
                >
                    <Input
                        id="adj-qty"
                        type="number"
                        step="0.001"
                        min="0"
                        {...form.register("quantity")}
                    />
                </Field>

                <fieldset>
                    <legend className="mb-1 text-sm font-medium text-text-primary">Direção</legend>
                    <div className="flex gap-4">
                        {ADJUSTMENT_DIRECTIONS.map((d) => (
                            <label key={d} className="flex items-center gap-2 text-sm">
                                <input type="radio" value={d} {...form.register("direction")} />
                                {d === "INCREASE" ? "Aumentar" : "Diminuir"}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <Field
                    label="Motivo"
                    htmlFor="adj-reason"
                    error={form.formState.errors.reason?.message}
                >
                    <Input id="adj-reason" {...form.register("reason")} />
                </Field>
            </form>
        </Modal>
    )
}