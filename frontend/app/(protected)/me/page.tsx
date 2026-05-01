"use client"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiError, useAuth } from "@/lib/auth"
import { changePasswordSchema, useChangeMyPassword, type ChangePasswordInput } from "@/lib/users"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

export default function MePage() {
    const { user } = useAuth()
    const changePassword = useChangeMyPassword()

    const form = useForm<ChangePasswordInput>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    })

    if (!user) return null

    async function onSubmit(values: ChangePasswordInput) {
        try {
            await changePassword.mutateAsync({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
            })
            form.reset()
            toast.success("Senha alterada com sucesso")
        } catch (err) {
            if (isApiError(err) && err.status === 400) {
                form.setError("currentPassword", { message: err.message })
            } else {
                toast.error("Não foi possível alterar a senha")
            }
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <h1 className="text-2xl font-semibold text-text-primary">Meu perfil</h1>

            <section className="rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Dados</h2>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-text-secondary">Nome</dt>
                        <dd className="text-text-primary">{user.name}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">E-mail</dt>
                        <dd className="text-text-primary">{user.email}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Perfil</dt>
                        <dd className="text-text-primary">{user.role}</dd>
                    </div>
                    <div>
                        <dt className="text-text-secondary">Ativo desde</dt>
                        <dd className="text-text-primary">
                            {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="rounded-xl border border-border/40 bg-white p-5">
                <h2 className="text-base font-semibold text-text-primary">Alterar senha</h2>
                <form className="mt-4 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                    <Field
                        label="Senha atual"
                        htmlFor="currentPassword"
                        error={form.formState.errors.currentPassword?.message}
                    >
                        <Input id="currentPassword" type="password" {...form.register("currentPassword")} />
                    </Field>
                    <Field
                        label="Nova senha"
                        htmlFor="newPassword"
                        error={form.formState.errors.newPassword?.message}
                    >
                        <Input id="newPassword" type="password" {...form.register("newPassword")} />
                    </Field>
                    <Field
                        label="Confirmar nova senha"
                        htmlFor="confirmPassword"
                        error={form.formState.errors.confirmPassword?.message}
                    >
                        <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
                    </Field>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={changePassword.isPending}>
                            {changePassword.isPending ? "Salvando..." : "Salvar senha"}
                        </Button>
                    </div>
                </form>
            </section>
        </div>
    )
}