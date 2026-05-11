"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
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
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editing ? "Editar unidade" : "Nova unidade"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form id="unit-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Endereço</FormLabel>
                                    <FormControl>
                                        <Input {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {editing ? (
                            <label className="flex items-center gap-2 text-sm text-text-primary">
                                <input type="checkbox" {...form.register("active" as never)} />
                                Ativa
                            </label>
                        ) : null}
                    </form>
                </Form>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="unit-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}