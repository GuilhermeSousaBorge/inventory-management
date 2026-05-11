"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                <form id="user-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>E-mail</FormLabel>
                                <FormControl>
                                    <Input type="email" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {!editing ? (
                        <FormField
                            control={form.control}
                            name={"password" as never}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Senha</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    ) : null}
                    <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Perfil</FormLabel>
                                <Select value={field.value || ""} onValueChange={field.onChange}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                                        <SelectItem value="OWNER">OWNER</SelectItem>
                                    </SelectContent>
                                </Select>
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
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="user-form" disabled={submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}