import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/orders",
}))

import OrdersPage from "@/app/(protected)/orders/page"
import { tokenStorage } from "@/lib/api"
import { renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
})

function meHandler(role: "OWNER" | "EMPLOYEE") {
    return {
        status: 200,
        data: {
            data: {
                id: "u1",
                name: "Ana",
                email: "a@x.com",
                role,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

function listHandler(status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED") {
    return {
        status: 200,
        data: {
            data: [
                {
                    id: "o1abcdef0000000000000000000000",
                    unitId: "un1",
                    unitName: "Centro",
                    status,
                    totalPrice: 91.8,
                    notes: null,
                    createdById: "u1",
                    startedAt: status === "PENDING" ? null : "2026-05-06T12:30:00Z",
                    completedAt: status === "COMPLETED" ? "2026-05-06T13:00:00Z" : null,
                    canceledAt: status === "CANCELED" ? "2026-05-06T12:35:00Z" : null,
                    createdAt: "2026-05-06T12:00:00Z",
                    items: [
                        {
                            id: "i1",
                            productId: "p1",
                            productName: "Margherita G",
                            quantity: 2,
                            unitPrice: 45.9,
                            subtotal: 91.8,
                        },
                    ],
                },
            ],
            page: 0,
            size: 20,
            total: 1,
        },
    }
}

describe("OrdersPage", () => {
    it("OWNER on PENDING sees Edit action", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/units"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/orders") && cfg.method === "get") return listHandler("PENDING")
            return { status: 500 }
        })
        renderWithProviders(<OrdersPage />)
        await waitFor(() => expect(screen.getByText("Centro")).toBeInTheDocument())
        // "Pendente" appears in both the filter dropdown and the row badge
        expect(screen.getAllByText(/Pendente/i).length).toBeGreaterThanOrEqual(2)
        expect(screen.getByLabelText(/^editar pedido/i)).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /novo pedido/i })).toBeInTheDocument()
    })

    it("OWNER on IN_PROGRESS hides Edit action (only PENDING is editable)", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/units"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/orders") && cfg.method === "get")
                return listHandler("IN_PROGRESS")
            return { status: 500 }
        })
        renderWithProviders(<OrdersPage />)
        await waitFor(() => expect(screen.getByText("Centro")).toBeInTheDocument())
        // status text appears in dropdown + badge, so check >=2
        expect(screen.getAllByText(/Em preparo/i).length).toBeGreaterThanOrEqual(2)
        expect(screen.queryByLabelText(/^editar pedido/i)).not.toBeInTheDocument()
    })

    it("EMPLOYEE sees no mutating actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/units"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/orders") && cfg.method === "get") return listHandler("PENDING")
            return { status: 500 }
        })
        renderWithProviders(<OrdersPage />)
        await waitFor(() => expect(screen.getByText("Centro")).toBeInTheDocument())
        expect(screen.queryByRole("link", { name: /novo pedido/i })).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/^editar pedido/i)).not.toBeInTheDocument()
    })
})
