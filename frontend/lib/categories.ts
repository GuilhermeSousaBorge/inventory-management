import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api";
import type { Page } from "@/lib/users";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export const createCategorySchema = z.object({
  name: z.string().min(1, "Informe o nome").max(100),
  description: z.string().max(255).optional().or(z.literal("")),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export function useCategories(page = 0, size = 20) {
  return useQuery({
    queryKey: ["categories", page, size],
    queryFn: () =>
      api
        .get<Page<Category>>("/categories", { params: { page, size } })
        .then((r) => r.data),
  });
}

export function useAllCategories() {
  return useQuery({
    queryKey: ["categories", "all"],
    queryFn: () =>
      api
        .get<Page<Category>>("/categories", { params: { page: 0, size: 1000 } })
        .then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: ["categories", id],
    queryFn: () => api.get<Category>(`/categories/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) =>
      api.post<Category>("/categories", input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      api.put<Category>(`/categories/${id}`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/categories/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
