"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/lib/auth"
import {
    createSupplierSchema,
    updateSupplierSchema,
    useCreateSupplier,
    useUpdateSupplier,
    type CreateSupplierInput,
    type Supplier,
    type UpdateSupplierInput,
} from "@/lib/suppliers"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
    supplier: Supplier | null
}

export function SupplierDialog({ open, onClose, supplier }: Props) {
    const editing = !!supplier
    const create = useCreateSupplier()
    const update = useUpdateSupplier()

    const form = useForm<CreateSupplierInput | UpdateSupplierInput>({
        resolver: zodResolver(editing ? updateSupplierSchema : createSupplierSchema),
        defaultValues: editing
            ? {
                  name: supplier.name,
                  contactName: supplier.contactName ?? "",
                  phone: supplier.phone ?? "",
                  email: supplier.email ?? "",
                  address: supplier.address ?? "",
                  active: supplier.active,
              }
            : { name: "", contactName: "", phone: "", email: "", address: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                editing
                    ? {
                          name: supplier.name,
                          contactName: supplier.contactName ?? "",
                          phone: supplier.phone ?? "",
                          email: supplier.email ?? "",
                          address: supplier.address ?? "",
                          active: supplier.active,
                      }
                    : { name: "", contactName: "", phone: "", email: "", address: "" },
            )
        }
    }, [open, editing, supplier, form])

    async function onSubmit(values: CreateSupplierInput | UpdateSupplierInput) {
        try {
            if (editing) {
                await update.mutateAsync({ id: supplier.id, input: values as UpdateSupplierInput })
                toast.success("Fornecedor atualizado")
            } else {
                await create.mutateAsync(values as CreateSupplierInput)
                toast.success("Fornecedor criado")
            }
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar fornecedor")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Editar fornecedor" : "Novo fornecedor"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="supplier-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="supplier-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <Field
                    label="Nome"
                    htmlFor="supplier-name"
                    error={form.formState.errors.name?.message}
                >
                    <Input id="supplier-name" {...form.register("name")} />
                </Field>
                <Field
                    label="Contato"
                    htmlFor="supplier-contact"
                    error={form.formState.errors.contactName?.message}
                >
                    <Input id="supplier-contact" {...form.register("contactName")} />
                </Field>
                <Field
                    label="Telefone"
                    htmlFor="supplier-phone"
                    error={form.formState.errors.phone?.message}
                >
                    <Input id="supplier-phone" {...form.register("phone")} />
                </Field>
                <Field
                    label="E-mail"
                    htmlFor="supplier-email"
                    error={form.formState.errors.email?.message}
                >
                    <Input id="supplier-email" type="email" {...form.register("email")} />
                </Field>
                <Field
                    label="Endereço"
                    htmlFor="supplier-address"
                    error={form.formState.errors.address?.message}
                >
                    <Input id="supplier-address" {...form.register("address")} />
                </Field>
                {editing ? (
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                        <input type="checkbox" {...form.register("active" as never)} />
                        Ativo
                    </label>
                ) : null}
            </form>
        </Modal>
    )
}
