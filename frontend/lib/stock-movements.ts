import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const MOVEMENT_TYPES = ["ENTRY", "EXIT", "ADJUSTMENT"] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const ADJUSTMENT_DIRECTIONS = ["INCREASE", "DECREASE"] as const
export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number]

export type StockMovement = {
    id: string
    ingredientId: string
    ingredientName: string
    unitId: string
    unitName: string
    type: MovementType
    quantity: number
    unitPrice: number | null
    reason: string | null
    purchaseOrderId: string | null
    createdById: string
    createdByName: string
    createdAt: string
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const createAdjustmentSchema = z.object({
    ingredientId: z.string().regex(UUID_REGEX, "Selecione um ingrediente"),
    unitId: z.string().regex(UUID_REGEX, "Selecione uma unidade"),
    quantity: z.coerce.number().positive("Informe uma quantidade positiva"),
    direction: z.enum(ADJUSTMENT_DIRECTIONS),
    reason: z.string().min(1, "Informe o motivo").max(255),
})
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>

export type StockMovementFilters = {
    ingredient?: string
    unit?: string
    type?: MovementType
    from?: string
    to?: string
    page?: number
    size?: number
}

export function useStockMovements(filters: StockMovementFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.ingredient) params.ingredient = filters.ingredient
    if (filters.unit) params.unit = filters.unit
    if (filters.type) params.type = filters.type
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "stock-movements",
            {
                ingredient: filters.ingredient ?? null,
                unit: filters.unit ?? null,
                type: filters.type ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () =>
            api.get<Page<StockMovement>>("/stock-movements", { params }).then((r) => r.data),
    })
}

export function useStockMovement(id: string) {
    return useQuery({
        queryKey: ["stock-movements", id],
        queryFn: () =>
            api.get<StockMovement>(`/stock-movements/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useCreateAdjustment() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateAdjustmentInput) =>
            api
                .post<StockMovement>("/stock-movements", input)
                .then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
        },
    })
}