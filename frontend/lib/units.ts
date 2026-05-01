import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export type Unit = {
    id: string
    name: string
    address: string | null
    active: boolean
    createdAt: string
}

export const createUnitSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(100),
    address: z.string().max(255).optional().or(z.literal("")),
})
export type CreateUnitInput = z.infer<typeof createUnitSchema>

export const updateUnitSchema = z.object({
    name: z.string().min(1).max(100),
    address: z.string().max(255).optional().or(z.literal("")),
    active: z.boolean(),
})
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>

export function useUnits(page = 0, size = 20) {
    return useQuery({
        queryKey: ["units", page, size],
        queryFn: () =>
            api.get<Page<Unit>>("/units", { params: { page, size } }).then((r) => r.data),
    })
}

export function useCreateUnit() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateUnitInput) =>
            api.post<Unit>("/units", input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
    })
}

export function useUpdateUnit() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateUnitInput }) =>
            api.put<Unit>(`/units/${id}`, input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
    })
}

export function useDeactivateUnit() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/units/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
    })
}