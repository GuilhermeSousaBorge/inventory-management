import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useQuery } from "@tanstack/react-query"

export const AUDIT_ACTIONS = [
    "USER_CREATED",
    "USER_UPDATED",
    "USER_DEACTIVATED",
    "USER_ROLE_CHANGED",
    "UNIT_CREATED",
    "UNIT_UPDATED",
    "UNIT_DEACTIVATED",
    "INGREDIENT_CREATED",
    "INGREDIENT_UPDATED",
    "INGREDIENT_MIN_UPDATED",
    "INGREDIENT_DEACTIVATED",
    "PRODUCT_CREATED",
    "PRODUCT_UPDATED",
    "PRODUCT_PRICE_CHANGED",
    "PRODUCT_RECIPE_CHANGED",
    "PRODUCT_DEACTIVATED",
    "STOCK_ENTRY",
    "STOCK_EXIT",
    "STOCK_ADJUSTMENT",
    "PURCHASE_ORDER_CREATED",
    "PURCHASE_ORDER_RECEIVED",
    "PURCHASE_ORDER_CANCELED",
    "ORDER_CREATED",
    "ORDER_UPDATED",
    "ORDER_STARTED",
    "ORDER_COMPLETED",
    "ORDER_CANCELED",
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ENTITY_TYPES = [
    "User",
    "Unit",
    "Ingredient",
    "Product",
    "StockMovement",
    "PurchaseOrder",
    "Order",
] as const
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export type AuditLog = {
    id: string
    action: AuditAction
    entityType: AuditEntityType | string
    entityId: string
    actorId: string
    actorName: string
    details: Record<string, unknown> | null
    createdAt: string
}

export type AuditLogFilters = {
    entityType?: AuditEntityType
    entityId?: string
    actorId?: string
    action?: AuditAction
    from?: string
    to?: string
    page?: number
    size?: number
}

const ACTION_LABELS: Record<AuditAction, string> = {
    USER_CREATED: "Usuário: criação",
    USER_UPDATED: "Usuário: alteração",
    USER_DEACTIVATED: "Usuário: desativação",
    USER_ROLE_CHANGED: "Usuário: papel alterado",
    UNIT_CREATED: "Unidade: criação",
    UNIT_UPDATED: "Unidade: alteração",
    UNIT_DEACTIVATED: "Unidade: desativação",
    INGREDIENT_CREATED: "Ingrediente: criação",
    INGREDIENT_UPDATED: "Ingrediente: alteração",
    INGREDIENT_MIN_UPDATED: "Ingrediente: mínimo alterado",
    INGREDIENT_DEACTIVATED: "Ingrediente: desativação",
    PRODUCT_CREATED: "Produto: criação",
    PRODUCT_UPDATED: "Produto: alteração",
    PRODUCT_PRICE_CHANGED: "Produto: preço alterado",
    PRODUCT_RECIPE_CHANGED: "Produto: ficha alterada",
    PRODUCT_DEACTIVATED: "Produto: desativação",
    STOCK_ENTRY: "Estoque: entrada",
    STOCK_EXIT: "Estoque: saída",
    STOCK_ADJUSTMENT: "Estoque: ajuste",
    PURCHASE_ORDER_CREATED: "Compra: criação",
    PURCHASE_ORDER_RECEIVED: "Compra: recebida",
    PURCHASE_ORDER_CANCELED: "Compra: cancelada",
    ORDER_CREATED: "Pedido: criação",
    ORDER_UPDATED: "Pedido: alteração",
    ORDER_STARTED: "Pedido: iniciado",
    ORDER_COMPLETED: "Pedido: concluído",
    ORDER_CANCELED: "Pedido: cancelado",
}

export function formatAuditAction(action: AuditAction): string {
    return ACTION_LABELS[action] ?? action
}

export function actionBadgeVariant(
    action: AuditAction,
): "success" | "neutral" | "warning" | "danger" {
    if (action.endsWith("_CREATED")) return "success"
    if (action.endsWith("_DEACTIVATED") || action.endsWith("_CANCELED")) return "neutral"
    if (
        action.startsWith("STOCK_") ||
        action.startsWith("ORDER_") ||
        action.startsWith("PURCHASE_ORDER_")
    )
        return "warning"
    return "neutral"
}

function fmtNum(v: unknown): string {
    if (typeof v === "number") return v.toLocaleString("pt-BR")
    return String(v)
}

export function summarizeAuditDetails(
    action: AuditAction,
    details: Record<string, unknown> | null,
): string {
    if (!details) return "—"
    const before = details.before as Record<string, unknown> | undefined
    const after = details.after as Record<string, unknown> | undefined

    if (action === "PRODUCT_PRICE_CHANGED" && before && after) {
        return `${fmtNum(before.price)} → ${fmtNum(after.price)}`
    }
    if (action === "INGREDIENT_MIN_UPDATED" && before && after) {
        return `${fmtNum(before.minQuantity)} → ${fmtNum(after.minQuantity)}`
    }
    if (action === "USER_ROLE_CHANGED" && before && after) {
        return `${before.role} → ${after.role}`
    }
    if (action === "STOCK_ENTRY" || action === "STOCK_EXIT" || action === "STOCK_ADJUSTMENT") {
        const qty = details.quantity
        const dir = details.direction
        if (qty !== undefined && dir) return `${dir} ${fmtNum(qty)}`
        if (qty !== undefined) return `${fmtNum(qty)}`
    }
    if (action === "ORDER_CREATED" || action === "ORDER_UPDATED") {
        const items = details.itemsCount ?? details.totalItems
        const total = details.totalPrice
        if (items !== undefined && total !== undefined) {
            return `${items} itens, ${fmtNum(total)}`
        }
    }

    const keys = Object.keys(details).filter((k) => k !== "before" && k !== "after")
    if (keys.length > 0) return keys.slice(0, 2).join(", ")
    return "—"
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.entityType) params.entityType = filters.entityType
    if (filters.entityId) params.entityId = filters.entityId
    if (filters.actorId) params.actorId = filters.actorId
    if (filters.action) params.action = filters.action
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "audit-logs",
            {
                entityType: filters.entityType ?? null,
                entityId: filters.entityId ?? null,
                actorId: filters.actorId ?? null,
                action: filters.action ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () =>
            api.get<Page<AuditLog>>("/audit-logs", { params }).then((r) => r.data),
    })
}

export function useAuditLog(id: string) {
    return useQuery({
        queryKey: ["audit-logs", id],
        queryFn: () => api.get<AuditLog>(`/audit-logs/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}