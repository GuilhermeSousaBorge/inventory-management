import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/stock-movements",
}))

import StockMovementsPage from "@/app/(protected)/stock-movements/page"
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
                email: "ana@x.com",
                role,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

function listHandler() {
    return {
        status: 200,
        data: {
            data: [
                {
                    id: "m1",
                    ingredientId: "ing1",
                    ingredientName: "Mussarela",
                    unitId: "un1",
                    unitName: "Centro",
                    type: "ENTRY",
                    quantity: 10,
                    unitPrice: 23,
                    reason: null,
                    purchaseOrderId: "po1abcdef0000000000000000000000",
                    createdById: "u1",
                    createdByName: "Ana",
                    createdAt: "2026-01-01T00:00:00Z",
                },
            ],
            page: 0,
            size: 20,
            total: 1,
        },
    }
}

describe("StockMovementsPage", () => {
    it("EMPLOYEE sees rows but no 'Novo ajuste' button", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.includes("/units"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/ingredients"))
                return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
            if (url.includes("/stock-movements") && cfg.method === "get") return listHandler()
            return { status: 500 }
        })
        renderWithProviders(<StockMovementsPage />)
        await waitFor(() => expect(screen.getByRole("cell", {name: "Mussarela"})).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /novo ajuste/i })).not.toBeInTheDocument()
    })

    it("OWNER opens modal, submits adjustment, list refetches", async () => {
        tokenStorage.setAccess("a1")
        let postCount = 0
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.includes("/units")) {
                return {
                    status: 200,
                    data: {
                        data: [{ id: "22222222-2222-2222-2222-222222222222", name: "Centro", address: null, active: true, createdAt: "2026-01-01T00:00:00Z" }],
                        page: 0,
                        size: 1000,
                        total: 1,
                    },
                }
            }
            if (url.includes("/ingredients")) {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "11111111-1111-1111-1111-111111111111",
                                name: "Mussarela",
                                description: null,
                                categoryId: "c1",
                                unitOfMeasure: "kg",
                                minimumQty: 5,
                                averageCost: 23,
                                expiryDate: null,
                                defaultSupplierId: null,
                                active: true,
                                createdAt: "2026-01-01T00:00:00Z",
                            },
                        ],
                        page: 0,
                        size: 1000,
                        total: 1,
                    },
                }
            }
            if (url.endsWith("/stock-movements") && cfg.method === "get") return listHandler()
            if (url.endsWith("/stock-movements") && cfg.method === "post") {
                postCount++
                return {
                    status: 201,
                    data: {
                        data: {
                            id: "m2",
                            ingredientId: "11111111-1111-1111-1111-111111111111",
                            ingredientName: "Mussarela",
                            unitId: "un1",
                            unitName: "Centro",
                            type: "ADJUSTMENT",
                            quantity: 1,
                            unitPrice: null,
                            reason: "Sobra",
                            purchaseOrderId: null,
                            createdById: "u1",
                            createdByName: "Ana",
                            createdAt: "2026-01-02T00:00:00Z",
                        },
                    },
                }
            }
            return { status: 500 }
        })
        renderWithProviders(<StockMovementsPage />)
        await waitFor(() => expect(screen.getByRole("cell", {name: "Mussarela"})).toBeInTheDocument())
        fireEvent.click(screen.getByRole("button", { name: /novo ajuste/i }))
        // wait for modal
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument())
        const dialog = within(screen.getByRole("dialog"))
        fireEvent.change(dialog.getByLabelText(/ingrediente/i), {
            target: { value: "11111111-1111-1111-1111-111111111111" },
        })
        fireEvent.change(dialog.getByLabelText(/unidade/i), { target: { value: "22222222-2222-2222-2222-222222222222" } })
        fireEvent.change(dialog.getByLabelText(/quantidade/i), { target: { value: "1" } })
        fireEvent.change(dialog.getByLabelText(/motivo/i), { target: { value: "Sobra" } })
        fireEvent.click(dialog.getByRole("button", { name: /salvar/i }))
        await waitFor(() => expect(postCount).toBe(1))
    })
})