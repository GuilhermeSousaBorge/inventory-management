import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api";
import type { Page } from "@/lib/users";

export type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
  createdAt: string;
};

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(150),
  contactName: z.string().max(100).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z
    .union([z.string().email("E-mail inválido").max(150), z.literal("")])
    .optional(),
  address: z.string().max(255).optional().or(z.literal("")),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.extend({
  active: z.boolean(),
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export function useSuppliers(params?: {
  active?: boolean;
  page?: number;
  size?: number;
}) {
  const page = params?.page ?? 0;
  const size = params?.size ?? 20;
  const active = params?.active;
  return useQuery({
    queryKey: ["suppliers", { active, page, size }],
    queryFn: () =>
      api
        .get<Page<Supplier>>("/suppliers", {
          params: { page, size, ...(active !== undefined ? { active } : {}) },
        })
        .then((r) => r.data),
  });
}

export function useActiveSuppliers() {
  return useQuery({
    queryKey: ["suppliers", "all-active"],
    queryFn: () =>
      api
        .get<Page<Supplier>>("/suppliers", {
          params: { page: 0, size: 1000, active: true },
        })
        .then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: ["suppliers", id],
    queryFn: () => api.get<Supplier>(`/suppliers/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupplierInput) =>
      api.post<Supplier>("/suppliers", input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSupplierInput }) =>
      api.put<Supplier>(`/suppliers/${id}`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useDeactivateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/suppliers/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}
