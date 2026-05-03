import { screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockReplace = vi.fn()
const searchParamsRef = { current: new URLSearchParams() }

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn() }),
    useSearchParams: () => searchParamsRef.current,
    usePathname: () => "/ingredients",
}))

import IngredientsPage from "@/app/(protected)/ingredients/page"
import { tokenStorage } from "@/lib/api"
import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
    mockReplace.mockReset()
    searchParamsRef.current = new URLSearchParams()
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

const CAT_ID = "11111111-1111-1111-1111-111111111111"
const SUP_ID = "22222222-2222-2222-2222-222222222222"

function categoriesPage(items: Array<{ id: string; name: string }>) {
    return {
        status: 200,
        data: {
            data: items.map((i) => ({ ...i, description: null, createdAt: "2026-01-01T00:00:00Z" })),
            page: 0,
            size: 1000,
            total: items.length,
        },
    }
}

function suppliersPage(items: Array<{ id: string; name: string }>) {
    return {
        status: 200,
        data: {
            data: items.map((i) => ({
                ...i,
                contactName: null,
                phone: null,
                email: null,
                address: null,
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            })),
            page: 0,
            size: 1000,
            total: items.length,
        },
    }
}

describe("IngredientsPage", () => {
    it("renders rows with resolved category and supplier names", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.endsWith("/categories")) return categoriesPage([{ id: CAT_ID, name: "Massas" }])
            if (url.endsWith("/suppliers")) return suppliersPage([{ id: SUP_ID, name: "Distribuidora ABC" }])
            if (url.includes("/ingredients") && cfg.method === "get") {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                id: "i1",
                                name: "Mussarela",
                                description: null,
                                categoryId: CAT_ID,
                                unitOfMeasure: "kg",
                                minimumQty: 5,
                                averageCost: 30,
                                expiryDate: null,
                                defaultSupplierId: SUP_ID,
                                active: true,
                                createdAt: "2026-01-01T00:00:00Z",
                            },
                        ],
                        page: 0,
                        size: 20,
                        total: 1,
                    },
                }
            }
            return { status: 500 }
        })
        renderWithProviders(<IngredientsPage />)
        await waitFor(() => expect(screen.getByText("Mussarela")).toBeInTheDocument())
        const row = screen.getByText("Mussarela").closest("tr")!
        expect(within(row).getByText("Massas")).toBeInTheDocument()
        expect(within(row).getByText("Distribuidora ABC")).toBeInTheDocument()
        expect(within(row).getByText("5 kg")).toBeInTheDocument()
    })

    it("EMPLOYEE does not see the create button", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("EMPLOYEE")
            if (url.endsWith("/categories")) return categoriesPage([])
            if (url.endsWith("/suppliers")) return suppliersPage([])
            if (url.includes("/ingredients") && cfg.method === "get") {
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            }
            return { status: 500 }
        })
        renderWithProviders(<IngredientsPage />)
        await waitFor(() =>
            expect(screen.getByText(/nenhum ingrediente cadastrado/i)).toBeInTheDocument(),
        )
        expect(screen.queryByRole("link", { name: /novo ingrediente/i })).not.toBeInTheDocument()
    })

    it("defaults to active=true on the ingredients query", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.endsWith("/categories")) return categoriesPage([])
            if (url.endsWith("/suppliers")) return suppliersPage([])
            if (url.includes("/ingredients") && cfg.method === "get") {
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            }
            return { status: 500 }
        })
        renderWithProviders(<IngredientsPage />)
        await waitFor(() => expect(screen.getByText(/nenhum ingrediente cadastrado/i)).toBeInTheDocument())
        const ingredientsCall = getCalls().find(
            (c) => (c.url ?? "").endsWith("/ingredients") && c.method === "get",
        )
        expect(ingredientsCall?.params).toMatchObject({ active: true })
    })

    it("respects ?category and ?active in URL", async () => {
        tokenStorage.setAccess("a1")
        searchParamsRef.current = new URLSearchParams(`category=${CAT_ID}&active=false`)
        setHandler((cfg) => {
            const url = cfg.url ?? ""
            if (url.endsWith("/users/me")) return meHandler("OWNER")
            if (url.endsWith("/categories")) return categoriesPage([{ id: CAT_ID, name: "Massas" }])
            if (url.endsWith("/suppliers")) return suppliersPage([])
            if (url.includes("/ingredients") && cfg.method === "get") {
                return { status: 200, data: { data: [], page: 0, size: 20, total: 0 } }
            }
            return { status: 500 }
        })
        renderWithProviders(<IngredientsPage />)
        await waitFor(() =>
            expect(screen.getByText(/nenhum ingrediente cadastrado/i)).toBeInTheDocument(),
        )
        const ingredientsCall = getCalls().find(
            (c) => (c.url ?? "").endsWith("/ingredients") && c.method === "get",
        )
        expect(ingredientsCall?.params).toMatchObject({ category: CAT_ID, active: false })
    })
})
