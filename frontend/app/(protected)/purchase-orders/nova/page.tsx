"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PurchaseOrderForm } from "../purchase-order-form";

export default function NewPurchaseOrderPage() {
  const { user } = useAuth();

  if (!user) return null;
  if (user.role !== "OWNER") {
    return (
      <div className="rounded-xl border border-border/60 bg-white p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para criar compras.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm text-muted-foreground">
        <Link href="/purchase-orders" className="hover:underline">
          Compras
        </Link>{" "}
        › <span className="text-foreground">Nova</span>
      </nav>
      <h1 className="text-2xl font-semibold text-foreground">Nova compra</h1>
      <PurchaseOrderForm mode="create" />
    </div>
  );
}
