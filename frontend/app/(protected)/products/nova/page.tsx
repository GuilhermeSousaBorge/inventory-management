"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ProductForm } from "../product-form";

export default function NewProductPage() {
  const { user } = useAuth();

  if (!user) return null;
  if (user.role !== "OWNER") {
    return (
      <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para criar produtos.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm text-muted-foreground">
        <Link href="/products" className="hover:underline">
          Produtos
        </Link>{" "}
        › <span className="text-foreground">Novo</span>
      </nav>
      <h1 className="text-2xl font-semibold text-foreground">Novo produto</h1>
      <ProductForm mode="create" />
    </div>
  );
}
