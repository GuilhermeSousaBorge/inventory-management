"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/lib/auth"
import {
    createCategorySchema,
    updateCategorySchema,
    useCreateCategory,
    useUpdateCategory,
    type Category,
    type CreateCategoryInput,
    type UpdateCategoryInput,
} from "@/lib/categories"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
    category: Category | null
}

export function CategoryDialog({ open, onClose, category }: Props) {
    const editing = !!category
    const create = useCreateCategory()
    const update = useUpdateCategory()

    const form = useForm<CreateCategoryInput | UpdateCategoryInput>({
        resolver: zodResolver(editing ? updateCategorySchema : createCategorySchema),
        defaultValues: editing
            ? { name: category.name, description: category.description ?? "" }
            : { name: "", description: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                editing
                    ? { name: category.name, description: category.description ?? "" }
                    : { name: "", description: "" },
            )
        }
    }, [open, editing, category, form])

    async function onSubmit(values: CreateCategoryInput | UpdateCategoryInput) {
        try {
            if (editing) {
                await update.mutateAsync({ id: category.id, input: values as UpdateCategoryInput })
                toast.success("Categoria atualizada")
            } else {
                await create.mutateAsync(values as CreateCategoryInput)
                toast.success("Categoria criada")
            }
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar categoria")
        }
    }

    const submitting = create.isPending || update.isPending

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Editar categoria" : "Nova categoria"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="category-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="category-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <Field
                    label="Nome"
                    htmlFor="category-name"
                    error={form.formState.errors.name?.message}
                >
                    <Input id="category-name" {...form.register("name")} />
                </Field>
                <Field
                    label="Descrição"
                    htmlFor="category-description"
                    error={form.formState.errors.description?.message}
                >
                    <Input id="category-description" {...form.register("description")} />
                </Field>
            </form>
        </Modal>
    )
}
