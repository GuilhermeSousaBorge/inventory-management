"use client"

import { Modal } from "@/components/overlays/modal"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { isApiError } from "@/lib/auth"
import {
    createUserSchema,
    updateUserSchema,
    useCreateUser,
    useUpdateUser,
    type CreateUserInput,
    type UpdateUserInput,
    type User,
} from "@/lib/users"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

type Props = {
    open: boolean
    onClose: () => void
    user: User | null
}

export function UserDialog({ open, onClose, user }: Props) {
    const editing = !!user
    const createUser = useCreateUser()
    const updateUser = useUpdateUser()

    const form = useForm<CreateUserInput | UpdateUserInput>({
        resolver: zodResolver(editing ? updateUserSchema : createUserSchema),
        defaultValues: editing
            ? { name: user.name, email: user.email, role: user.role, active: user.active }
            : { name: "", email: "", password: "", role: "EMPLOYEE" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                editing
                    ? { name: user.name, email: user.email, role: user.role, active: user.active }
                    : { name: "", email: "", password: "", role: "EMPLOYEE" },
            )
        }
    }, [open, editing, user, form])

    async function onSubmit(values: CreateUserInput | UpdateUserInput) {
        try {
            if (editing) {
                await updateUser.mutateAsync({ id: user.id, input: values as UpdateUserInput })
                toast.success("Usuário atualizado")
            } else {
                await createUser.mutateAsync(values as CreateUserInput)
                toast.success("Usuário criado")
            }
            onClose()
        } catch (err) {
            if (isApiError(err)) toast.error(err.message)
            else toast.error("Erro ao salvar usuário")
        }
    }

    const submitting = createUser.isPending || updateUser.isPending

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Editar usuário" : "Novo usuário"}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="user-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </>
            }
        >
            <form id="user-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <Field label="Nome" htmlFor="name" error={form.formState.errors.name?.message}>
                    <Input id="name" {...form.register("name")} />
                </Field>
                <Field label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
                    <Input id="email" type="email" {...form.register("email")} />
                </Field>
                {!editing ? (
                    <Field
                        label="Senha"
                        htmlFor="password"
                        error={(form.formState.errors as Record<string, { message?: string }>).password?.message}
                    >
                        <Input id="password" type="password" {...form.register("password" as never)} />
                    </Field>
                ) : null}
                <Field label="Perfil" htmlFor="role" error={form.formState.errors.role?.message}>
                    <Select id="role" {...form.register("role")}>
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="OWNER">OWNER</option>
                    </Select>
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