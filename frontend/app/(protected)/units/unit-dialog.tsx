"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/lib/auth"
import {
    createUnitSchema,
    updateUnitSchema,
    useCreateUnit,
    useUpdateUnit,
    type CreateUnitInput,
    type Unit,
    type UpdateUnitInput,
} from "@/lib/units"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
    unit: Unit | null
}

export function UnitDialog({ open, onClose, unit }: Props) {
    const editing = !!unit
    const create = useCreateUnit()
    const update = useUpdateUnit()

    const form = useForm<CreateUnitInput | UpdateUnitInput>({
        resolver: zodResolver(editing ? updateUnitSchema : createUnitSchema),
        defaultValues: editing
            ? { name: unit.name, address: unit.address ?? "", active: unit.active }
            : { name: "", address: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                editing
                    ? { name: unit.name, address: unit.address ?? "", active: unit.active }
                    : { name: "", address: "" },
            )
        }
    }, [open, editing, unit, form])

    async function onSubmit(values: CreateUnitInput | UpdateUnitInput) {
        try {
            if (editing) {
                await update.mutateAsync({ id: unit.id, input: values as UpdateUnitInput })
                toast.success("Unidade atualizada")
            } else {
                await create.mutateAsync(values as CreateUnitInput)
                toast.success("Unidade criada")
            }
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar unidade")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Editar unidade" : "Nova unidade"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="unit-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="unit-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <Field label="Nome" htmlFor="unit-name" error={form.formState.errors.name?.message}>
                    <Input id="unit-name" {...form.register("name")} />
                </Field>
                <Field
                    label="Endereço"
                    htmlFor="unit-address"
                    error={form.formState.errors.address?.message}
                >
                    <Input id="unit-address" {...form.register("address")} />
                </Field>
                {editing ? (
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                        <input type="checkbox" {...form.register("active" as never)} />
                        Ativa
                    </label>
                ) : null}
            </form>
        </Modal>
    )
}