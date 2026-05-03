import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const PURCHASE_ORDER_STATUSES = ["PENDING", "RECEIVED", "CANCELED"] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

export type PurchaseOrderItem = {
    id: string
    ingredientId: string
    ingredientName: string
    quantity: number
    unitPrice: number
}

export type PurchaseOrder = {
    id: string
    supplierId: string
    supplierName: string
    unitId: string
    unitName: string
    status: PurchaseOrderStatus
    totalCost: number
    notes: string | null
    expectedAt: string | null
    receivedAt: string | null
    canceledAt: string | null
    createdById: string
    createdByName: string
    createdAt: string
    items: PurchaseOrderItem[]
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const purchaseOrderItemSchema = z.object({
    ingredientId: z.string().regex(UUID_REGEX, "Selecione um ingrediente"),
    quantity: z.coerce.number().positive("Quantidade > 0"),
    unitPrice: z.coerce.number().positive("Preço > 0"),
})
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>

export const createPurchaseOrderSchema = z.object({
    supplierId: z.string().regex(UUID_REGEX, "Selecione um fornecedor"),
    unitId: z.string().regex(UUID_REGEX, "Selecione uma unidade"),
    expectedAt: z
        .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"), z.literal("")])
        .optional(),
    notes: z.string().max(500).optional().or(z.literal("")),
    items: z
        .array(purchaseOrderItemSchema)
        .min(1, "Adicione ao menos 1 item")
        .refine(
            (arr) => new Set(arr.map((i) => i.ingredientId)).size === arr.length,
            "Ingredientes duplicados não são permitidos"
        ),
})
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = createPurchaseOrderSchema
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>

export type PurchaseOrderFilters = {
    status?: PurchaseOrderStatus
    supplier?: string
    unit?: string
    from?: string
    to?: string
    page?: number
    size?: number
}

export function usePurchaseOrders(filters: PurchaseOrderFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.status) params.status = filters.status
    if (filters.supplier) params.supplier = filters.supplier
    if (filters.unit) params.unit = filters.unit
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "purchase-orders",
            {
                status: filters.status ?? null,
                supplier: filters.supplier ?? null,
                unit: filters.unit ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () =>
            api.get<Page<PurchaseOrder>>("/purchase-orders", { params }).then((r) => r.data),
    })
}

export function usePurchaseOrder(id: string) {
    return useQuery({
        queryKey: ["purchase-orders", id],
        queryFn: () =>
            api.get<PurchaseOrder>(`/purchase-orders/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

function normalizePayload(input: CreatePurchaseOrderInput | UpdatePurchaseOrderInput) {
    return {
        ...input,
        expectedAt: input.expectedAt === "" ? null : input.expectedAt,
        notes: input.notes === "" ? null : input.notes,
    }
}

export function useCreatePurchaseOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreatePurchaseOrderInput) =>
            api
                .post<PurchaseOrder>("/purchase-orders", normalizePayload(input))
                .then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
    })
}

export function useUpdatePurchaseOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdatePurchaseOrderInput }) =>
            api
                .put<PurchaseOrder>(`/purchase-orders/${id}`, normalizePayload(input))
                .then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
    })
}

export function useReceivePurchaseOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["purchase-orders"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
        },
    })
}

export function useCancelPurchaseOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
    })
}