import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api";
import type { Page } from "@/lib/users";

export const UNITS_OF_MEASURE = ["kg", "g", "L", "ml", "un", "cx"] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

export type Ingredient = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  unitOfMeasure: UnitOfMeasure;
  minimumQty: number;
  averageCost: number;
  expiryDate: string | null;
  defaultSupplierId: string | null;
  active: boolean;
  createdAt: string;
};

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const createIngredientSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(150),
  description: z.string().max(255).optional().or(z.literal("")),
  categoryId: z.string().regex(UUID_REGEX, "Selecione uma categoria"),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
  minimumQty: z.coerce.number().nonnegative("Não pode ser negativo"),
  expiryDate: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
      z.literal(""),
    ])
    .optional(),
  defaultSupplierId: z
    .union([z.string().regex(UUID_REGEX), z.literal("")])
    .optional(),
});
export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;

export const updateIngredientSchema = createIngredientSchema.extend({
  active: z.boolean(),
});
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;

export type IngredientFilters = {
  category?: string;
  active?: boolean;
  page?: number;
  size?: number;
};

export function useIngredients(filters: IngredientFilters = {}) {
  const page = filters.page ?? 0;
  const size = filters.size ?? 20;
  const params: Record<string, string | number | boolean> = { page, size };
  if (filters.category) params.category = filters.category;
  if (filters.active !== undefined) params.active = filters.active;
  return useQuery({
    queryKey: [
      "ingredients",
      {
        category: filters.category ?? null,
        active: filters.active ?? null,
        page,
        size,
      },
    ],
    queryFn: () =>
      api.get<Page<Ingredient>>("/ingredients", { params }).then((r) => r.data),
  });
}

export function useIngredient(id: string) {
  return useQuery({
    queryKey: ["ingredients", id],
    queryFn: () =>
      api.get<Ingredient>(`/ingredients/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

function normalizeIngredientPayload<
  T extends {
    description?: string;
    expiryDate?: string;
    defaultSupplierId?: string;
  },
>(input: T) {
  return {
    ...input,
    description: input.description === "" ? null : input.description,
    expiryDate: input.expiryDate === "" ? null : input.expiryDate,
    defaultSupplierId:
      input.defaultSupplierId === "" ? null : input.defaultSupplierId,
  };
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIngredientInput) =>
      api
        .post<Ingredient>("/ingredients", normalizeIngredientPayload(input))
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

export function useUpdateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIngredientInput }) =>
      api
        .put<Ingredient>(
          `/ingredients/${id}`,
          normalizeIngredientPayload(input),
        )
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

export function useDeactivateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/ingredients/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

export function useAllIngredients() {
  return useQuery({
    queryKey: ["ingredients", "all-active"],
    queryFn: () =>
      api
        .get<Page<Ingredient>>("/ingredients", {
          params: { page: 0, size: 1000, active: true },
        })
        .then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
