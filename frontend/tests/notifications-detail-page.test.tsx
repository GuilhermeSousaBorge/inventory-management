import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import NotificationDetailPage from "@/app/(protected)/notifications/[id]/page"
import { tokenStorage } from "@/lib/api"

import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/notifications/n-1",
    useParams: () => ({ id: "n-1" }),
}))

const sample = {
    id: "n-1",
    type: "LOW_STOCK",
    status: "ACTIVE",
    ingredientId: "i-1",
    ingredientName: "Mozzarella",
    unitId: "u-1",
    unitName: "Centro",
    message: "Mozzarella abaixo do mínimo na unidade Centro: 0.500 kg ≤ 1.000 kg",
    triggeredQuantity: 0.5,
    minQuantity: 1.0,
    createdAt: "2026-05-07T12:00:00",
    resolvedAt: null,
    resolvedBy: null,
}

function meHandler(role: "OWNER" | "EMPLOYEE") {
    return {
        status: 200,
        data: {
            data: {
                id: "u-1",
                name: "Test",
                email: "t@t.com",
                role,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("/notifications/[id]", () => {
    it("OWNER sees Resolver button on ACTIVE alert", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            return { status: 200, data: { data: sample } }
        })
        renderWithProviders(<NotificationDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Mozzarella")).toBeInTheDocument(),
        )
        expect(screen.getByText("Resolver")).toBeInTheDocument()
    })

    it("EMPLOYEE does not see Resolver button", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            return { status: 200, data: { data: sample } }
        })
        renderWithProviders(<NotificationDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Mozzarella")).toBeInTheDocument(),
        )
        expect(screen.queryByText("Resolver")).not.toBeInTheDocument()
    })

    it("clicking Resolver opens dialog and confirming POSTs", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (cfg.method === "post") {
                return {
                    status: 200,
                    data: { data: { ...sample, status: "RESOLVED" } },
                }
            }
            return { status: 200, data: { data: sample } }
        })
        renderWithProviders(<NotificationDetailPage />)
        await waitFor(() => expect(screen.getByText("Resolver")).toBeInTheDocument())
        fireEvent.click(screen.getByText("Resolver"))
        const dialog = await screen.findByRole("dialog")
        const confirmBtn = within(dialog).getByRole("button", { name: "Resolver" })
        fireEvent.click(confirmBtn)
        await waitFor(() => {
            const post = getCalls().find((c) => c.method === "post")
            expect(post?.url).toBe("/notifications/n-1/resolve")
        })
    })

    it("shows 'Resolução automática' when resolvedBy is null and status RESOLVED", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            return {
                status: 200,
                data: {
                    data: {
                        ...sample,
                        status: "RESOLVED",
                        resolvedAt: "2026-05-07T13:00:00",
                        resolvedBy: null,
                    },
                },
            }
        })
        renderWithProviders(<NotificationDetailPage />)
        await waitFor(() =>
            expect(screen.getByText("Resolução automática")).toBeInTheDocument(),
        )
    })
})
