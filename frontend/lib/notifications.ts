import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export const NOTIFICATION_TYPES = ["LOW_STOCK"] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_STATUSES = ["ACTIVE", "RESOLVED"] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export type Notification = {
    id: string
    type: NotificationType
    status: NotificationStatus
    ingredientId: string
    ingredientName: string
    unitId: string
    unitName: string
    message: string
    triggeredQuantity: number
    minQuantity: number
    createdAt: string
    resolvedAt: string | null
    resolvedBy: { id: string; name: string } | null
}

export type NotificationFilters = {
    status?: NotificationStatus
    unit?: string
    from?: string
    to?: string
    page?: number
    size?: number
}

export function useNotifications(filters: NotificationFilters = {}) {
    const page = filters.page ?? 0
    const size = filters.size ?? 20
    const params: Record<string, string | number> = { page, size }
    if (filters.status) params.status = filters.status
    if (filters.unit) params.unit = filters.unit
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    return useQuery({
        queryKey: [
            "notifications",
            {
                status: filters.status ?? null,
                unit: filters.unit ?? null,
                from: filters.from ?? null,
                to: filters.to ?? null,
                page,
                size,
            },
        ],
        queryFn: () =>
            api.get<Page<Notification>>("/notifications", { params }).then((r) => r.data),
    })
}

export function useNotification(id: string) {
    return useQuery({
        queryKey: ["notifications", id],
        queryFn: () =>
            api.get<Notification>(`/notifications/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useResolveNotification() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) =>
            api.post<Notification>(`/notifications/${id}/resolve`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    })
}

export function useActiveNotificationsBell() {
    const query = useQuery({
        queryKey: [
            "notifications",
            { status: "ACTIVE", unit: null, from: null, to: null, page: 0, size: 5 },
        ],
        queryFn: () =>
            api
                .get<Page<Notification>>("/notifications", {
                    params: { page: 0, size: 5, status: "ACTIVE" },
                })
                .then((r) => r.data),
        refetchInterval: 60_000,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    })
    return {
        total: query.data?.total ?? 0,
        items: query.data?.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
    }
}