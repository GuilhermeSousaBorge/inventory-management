import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/purchase-orders/po1",
    useParams: () => ({ id: "po1" }),
}))

import PurchaseOrderDetailPage from "@/app/(protected)/purchase-orders/[id]/page"
import { tokenStorage } from "@/lib/api"
import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

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

function poHandler(status: "PENDING" | "RECEIVED" | "CANCELED") {
    return {
        status: 200,
        data: {
            data: {
                id: "po1abcdef0000000000000000000000",
                supplierId: "s1",
                supplierName: "Distribuidora ABC",
                unitId: "un1",
                unitName: "Centro",
                status,
                totalCost: 100,
                notes: null,
                expectedAt: null,
                receivedAt: null,
                canceledAt: null,
                createdById: "u1",
                createdByName: "Ana",
                createdAt: "2026-01-01T00:00:00Z",
                items: [
                    {
                        id: "it1",
                        ingredientId: "ing1",
                        ingredientName: "Mussarela",
                        quantity: 5,
                        unitPrice: 20,
                    },
                ],
            },
        },
    }
}

describe("PurchaseOrderDetailPage", () => {
    it("OWNER + PENDING shows Receive and Cancel; clicking Receive triggers POST", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/purchase-orders/po1/receive") && cfg.method === "post") {
                return { status: 200, data: { data: poHandler("RECEIVED").data.data } }
            }
            if (url.includes("/purchase-orders/po1") && cfg.method === "get") {
                return poHandler("PENDING")
            }
            return { status: 500 }
        })
        renderWithProviders(<PurchaseOrderDetailPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        const receiveBtn = screen.getByRole("button", { name: /receber/i })
        const cancelBtn = screen.getByRole("button", { name: /cancelar/i })
        expect(receiveBtn).toBeInTheDocument()
        expect(cancelBtn).toBeInTheDocument()

        fireEvent.click(receiveBtn)
        // confirm dialog
        await waitFor(() => expect(screen.getByText(/recebimento/i)).toBeInTheDocument())
        // click confirm in dialog (label = "Receber" inside dialog)
        const dialogConfirm = screen.getAllByRole("button", { name: /receber/i }).pop()!
        fireEvent.click(dialogConfirm)

        await waitFor(() => {
            const post = getCalls().find(
                (c) => c.method === "post" && c.url?.includes("/receive")
            )
            expect(post).toBeTruthy()
        })
    })

    it("RECEIVED PO shows no actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/purchase-orders/po1") && cfg.method === "get") return poHandler("RECEIVED")
            return { status: 500 }
        })
        renderWithProviders(<PurchaseOrderDetailPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /^receber$/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /^cancelar$/i })).not.toBeInTheDocument()
    })

    it("EMPLOYEE on PENDING sees no actions", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/purchase-orders/po1") && cfg.method === "get") return poHandler("PENDING")
            return { status: 500 }
        })
        renderWithProviders(<PurchaseOrderDetailPage />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /^receber$/i })).not.toBeInTheDocument()
    })
})