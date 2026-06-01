"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isApiError } from "@/lib/auth";
import { useAllCategories } from "@/lib/categories";
import {
  type CreateIngredientInput,
  createIngredientSchema,
  type Ingredient,
  UNITS_OF_MEASURE,
  type UpdateIngredientInput,
  updateIngredientSchema,
  useCreateIngredient,
  useUpdateIngredient,
} from "@/lib/ingredients";
import { useActiveSuppliers } from "@/lib/suppliers";

type Props = {
  mode: "create" | "edit";
  initial?: Ingredient;
};

export function IngredientForm({ mode, initial }: Props) {
  const router = useRouter();
  const categories = useAllCategories();
  const suppliers = useActiveSuppliers();
  const create = useCreateIngredient();
  const update = useUpdateIngredient();

  const form = useForm<UpdateIngredientInput>({
    // Zod v4's z.coerce.number() on minimumQty produces an input/output
    // mismatch that RHF's Resolver cannot unify across the
    // CreateIngredientInput | UpdateIngredientInput union. We type the
    // form as the superset (UpdateIngredientInput); the correct schema
    // is still selected at runtime by `mode`, and the `active` field is
    // gated to edit mode in JSX so RHF never registers it on create.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(
      mode === "edit" ? updateIngredientSchema : createIngredientSchema,
    ) as any,
    defaultValues:
      mode === "edit" && initial
        ? {
            name: initial.name,
            description: initial.description ?? "",
            categoryId: initial.categoryId,
            unitOfMeasure: initial.unitOfMeasure,
            minimumQty: initial.minimumQty,
            expiryDate: initial.expiryDate ?? "",
            defaultSupplierId: initial.defaultSupplierId ?? "",
            active: initial.active,
          }
        : {
            name: "",
            description: "",
            categoryId: "",
            unitOfMeasure: "kg",
            minimumQty: 0,
            expiryDate: "",
            defaultSupplierId: "",
          },
  });

  async function onSubmit(values: UpdateIngredientInput) {
    try {
      if (mode === "edit" && initial) {
        await update.mutateAsync({
          id: initial.id,
          input: values as UpdateIngredientInput,
        });
        toast.success("Ingrediente atualizado");
      } else {
        await create.mutateAsync(values as CreateIngredientInput);
        toast.success("Ingrediente criado");
      }
      router.replace("/ingredients");
    } catch (err) {
      if (isApiError(err)) toast.error(err.message);
      else toast.error("Erro ao salvar ingrediente");
    }
  }

  const submitting = create.isPending || update.isPending;

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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

        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <Select
                value={field.value || ""}
                onValueChange={field.onChange}
                disabled={categories.isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        categories.isPending ? "Carregando..." : "Selecione..."
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="unitOfMeasure"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unidade de medida</FormLabel>
              <Select value={field.value || ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {UNITS_OF_MEASURE.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="minimumQty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade mínima</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  {...field}
                  value={field.value ?? 0}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expiryDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Validade</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultSupplierId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fornecedor padrão</FormLabel>
              <Select
                value={field.value || "__none"}
                onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                disabled={suppliers.isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        suppliers.isPending ? "Carregando..." : "Nenhum"
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {suppliers.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === "edit" ? (
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  Ativo
                </label>
              </FormItem>
            )}
          />
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.replace("/ingredients")}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
