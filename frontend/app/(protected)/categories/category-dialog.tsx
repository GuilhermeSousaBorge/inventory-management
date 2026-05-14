"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
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
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form id="category-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl>
                                        <Input {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="category-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
