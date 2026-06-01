"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { isApiError, useAuth } from "@/lib/auth";
import {
  type ChangePasswordInput,
  changePasswordSchema,
  useChangeMyPassword,
} from "@/lib/users";

export default function MePage() {
  const { user } = useAuth();
  const changePassword = useChangeMyPassword();

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  if (!user) return null;

  async function onSubmit(values: ChangePasswordInput) {
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.reset();
      toast.success("Senha alterada com sucesso");
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        form.setError("currentPassword", { message: err.message });
      } else {
        toast.error("Não foi possível alterar a senha");
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Meu perfil</h1>

      <section className="rounded-xl border border-border/40 bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">Dados</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Nome</dt>
            <dd className="text-foreground">{user.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="text-foreground">{user.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Perfil</dt>
            <dd className="text-foreground">{user.role}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ativo desde</dt>
            <dd className="text-foreground">
              {new Date(user.createdAt).toLocaleDateString("pt-BR")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border/40 bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">
          Alterar senha
        </h2>
        <Form {...form}>
          <form
            className="mt-4 space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha atual</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova senha</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar nova senha</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? "Salvando..." : "Salvar senha"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </div>
  );
}
