"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
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
            <Form {...form}>
                <form id="supplier-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                        name="contactName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Contato</FormLabel>
                                <FormControl>
                                    <Input {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <FormControl>
                                    <Input {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>E-mail</FormLabel>
                                <FormControl>
                                    <Input type="email" {...field} value={field.value ?? ""} />
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
                            Ativo
                        </label>
                    ) : null}
                </form>
            </Form>
        </Modal>
    )
}
