import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const ORDER_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELED"] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type OrderItem = {
    id: string
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    subtotal: number
}

export type Order = {
    id: string
    unitId: string
    unitName: string
    status: OrderStatus
    totalPrice: number
    notes: string | null
    createdById: string
    startedAt: string | null
    completedAt: string | null
    canceledAt: string | null
    createdAt: string
    items: OrderItem[]
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const orderItemSchema = z.object({
    productId: z.string().regex(UUID_REGEX, "Selecione um produto"),
    quantity: z.coerce.number().int("Quantidade inteira").min(1, "Mínimo 1"),
})
export type OrderItemInput = z.infer<typeof orderItemSchema>

export const createOrderSchema = z.object({
    unitId: z.string().regex(UUID_REGEX, "Selecione uma unidade"),
    notes: z.string().max(500).optional().or(z.literal("")),
    items: z
        .array(orderItemSchema)
        .min(1, "Adicione ao menos 1 item")
        .refine(
            (arr) => new Set(arr.map((i) => i.productId)).size === arr.length,
            "Produtos duplicados não são permitidos"
        ),
})
export type CreateOrderInput = z.infer<typeof createOrderSchema>

export const updateOrderSchema = createOrderSchema
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>

export type OrderFilters = {
    unit?: string
    status?: OrderStatus
    from?: string
    to?: string
    page?: number
    size?: number
}

export function useOrders(filters: OrderFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.unit) params.unit = filters.unit
    if (filters.status) params.status = filters.status
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "orders",
            {
                unit: filters.unit ?? null,
                status: filters.status ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () => api.get<Page<Order>>("/orders", { params }).then((r) => r.data),
    })
}

export function useOrder(id: string) {
    return useQuery({
        queryKey: ["orders", id],
        queryFn: () => api.get<Order>(`/orders/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

function normalizePayload(input: CreateOrderInput | UpdateOrderInput) {
    return {
        ...input,
        notes: input.notes === "" ? null : input.notes,
    }
}

export function useCreateOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateOrderInput) =>
            api.post<Order>("/orders", normalizePayload(input)).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    })
}

export function useUpdateOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateOrderInput }) =>
            api.put<Order>(`/orders/${id}`, normalizePayload(input)).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    })
}

export function useStartOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<Order>(`/orders/${id}/start`).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["orders"] })
            qc.invalidateQueries({ queryKey: ["stock"] })
            qc.invalidateQueries({ queryKey: ["stock-movements"] })
            qc.invalidateQueries({ queryKey: ["notifications"] })
        },
    })
}

export function useCompleteOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<Order>(`/orders/${id}/complete`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    })
}

export function useCancelOrder() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<Order>(`/orders/${id}/cancel`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    })
}
