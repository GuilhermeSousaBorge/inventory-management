import { api } from '@/lib/api';
import type { Page } from '@/lib/users';
import { useQuery } from "@tanstack/react-query";


export type Stock = {
    id: string
    ingredientId: string
    ingredientName: string
    unitId: string
    unitName: string
    quantity: number
    minimumQty: number
    belowMinimum: boolean
    averageCost: number
    updatedAt: string
}

export type StockFilters = {
    unit?: string
    ingredient?: string
    page?: number
    size?: number
}

export function useStock(filters: StockFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.unit) params.unit = filters.unit
    if (filters.ingredient) params.ingredient = filters.ingredient

    return useQuery({
        queryKey: ["stock", {unit: filters.unit ?? null, ingredient: filters.ingredient ?? null, page, size }],
        queryFn: () => api.get<Page<Stock>>("/stock", {params}).then((r) => r.data),
    })
}

export function useStockItem(id: string) {
    return useQuery({
        queryKey: ["stock", id],
        queryFn: () => api.get<Stock>(`/stock/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useLowStock(params?: { page?: number; size?: number }) {
    const page = params?.page ?? 0
    const size = params?.size ?? 20
    return useQuery({
        queryKey: ["stock", "low", {page, size}],
        queryFn: () => api.get<Page<Stock>>("/stock/low", { params: { page, size } }).then((r) => r.data),
    })

}