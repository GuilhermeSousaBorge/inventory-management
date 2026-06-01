"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { IngredientForm } from "../ingredient-form";

export default function NewIngredientPage() {
  const { user } = useAuth();

  if (user?.role !== "OWNER") return <NoAccess />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          <Link href="/ingredients" className="hover:underline">
            Ingredientes
          </Link>{" "}
          › Novo
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          Novo ingrediente
        </h1>
      </header>

      <div className="mx-auto max-w-2xl rounded-xl border border-border/40 bg-white p-6">
        <IngredientForm mode="create" />
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-white p-8 text-center">
      <h2 className="text-base font-semibold text-foreground">Sem permissão</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Apenas o proprietário pode criar ingredientes.
      </p>
    </div>
  );
}
