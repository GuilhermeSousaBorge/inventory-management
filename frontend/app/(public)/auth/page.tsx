"use client";

import { Flame } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isApiError, useAuth } from "@/lib/auth";

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AuthForm />
    </Suspense>
  );
}

function AuthFallback() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="text-sm text-muted-foreground">Carregando...</div>
    </main>
  );
}

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, status } = useAuth();
  const expired = params.get("expired") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await login(email, password);
      router.replace("/home");
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setFormError("E-mail ou senha inválidos.");
      } else if (isApiError(err) && err.status === 0) {
        setFormError("Falha ao se conectar com o servidor.");
      } else {
        setFormError("Não foi possível entrar. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/40 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive text-white">
            <Flame className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">
            Forno Vivo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre para gerenciar sua pizzaria
          </p>
        </div>

        {expired ? (
          <div className="mt-6 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-xs text-foreground">
            Sua sessão expirou. Faça login novamente.
          </div>
        ) : null}

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          {formError ? (
            <p className="text-center text-sm text-destructive">{formError}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
