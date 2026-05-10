import { api } from "@/lib/api"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export type ConsumptionReportRow = {
    ingredientId: string
    ingredientName: string
    unitOfMeasure: string
    totalQuantity: number
    movementCount: number
}

export type SalesReportRow = {
    productId: string
    productName: string
    size: "P" | "M" | "G" | "GG"
    unitsSold: number
    revenue: number
    ordersCount: number
}

export type WasteReportRow = {
    ingredientId: string
    ingredientName: string
    unitOfMeasure: string
    wasteQuantity: number
    adjustmentCount: number
}

export type StockStatusRow = {
    ingredientId: string
    ingredientName: string
    unitOfMeasure: string
    currentQuantity: number
    minQuantity: number
    level: "LOW" | "WARNING" | "OK"
}

export const reportsRangeFiltersSchema = z
    .object({
        from: z.string().min(1, "Informe a data inicial"),
        to: z.string().min(1, "Informe a data final"),
        unit: z.string().regex(UUID_REGEX).optional().or(z.literal("")),
        ingredient: z.string().regex(UUID_REGEX).optional().or(z.literal("")),
        product: z.string().regex(UUID_REGEX).optional().or(z.literal("")),
    })
    .refine((v) => new Date(v.from) <= new Date(v.to), {
        path: ["to"],
        message: '"Até" deve ser maior ou igual a "De"',
    })
export type ReportsRangeFiltersInput = z.infer<typeof reportsRangeFiltersSchema>

export type RangeReportFilters = {
    from: string
    to: string
    unit?: string
    ingredient?: string
    product?: string
}

function buildRangeParams(filters: RangeReportFilters) {
    const params: Record<string, string> = { from: filters.from, to: filters.to }
    if (filters.unit) params.unit = filters.unit
    if (filters.ingredient) params.ingredient = filters.ingredient
    if (filters.product) params.product = filters.product
    return params
}

export function useConsumptionReport(filters: RangeReportFilters) {
    const enabled = !!filters.from && !!filters.to
    return useQuery({
        queryKey: ["reports", "consumption", filters],
        queryFn: () =>
            api
                .get<ConsumptionReportRow[]>("/reports/consumption", {
                    params: buildRangeParams(filters),
                })
                .then((r) => r.data),
        enabled,
    })
}

export function useSalesReport(filters: RangeReportFilters) {
    const enabled = !!filters.from && !!filters.to
    return useQuery({
        queryKey: ["reports", "sales", filters],
        queryFn: () =>
            api
                .get<SalesReportRow[]>("/reports/sales", {
                    params: buildRangeParams(filters),
                })
                .then((r) => r.data),
        enabled,
    })
}

export function useWasteReport(filters: RangeReportFilters) {
    const enabled = !!filters.from && !!filters.to
    return useQuery({
        queryKey: ["reports", "waste", filters],
        queryFn: () =>
            api
                .get<WasteReportRow[]>("/reports/waste", {
                    params: buildRangeParams(filters),
                })
                .then((r) => r.data),
        enabled,
    })
}

export function useStockStatusReport(filters: { unit?: string }) {
    const params: Record<string, string> = {}
    if (filters.unit) params.unit = filters.unit
    return useQuery({
        queryKey: ["reports", "stock-status", filters],
        queryFn: () =>
            api
                .get<StockStatusRow[]>("/reports/stock-status", { params })
                .then((r) => r.data),
    })
}