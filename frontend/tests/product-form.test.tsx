import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replaceMock = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/products/nova",
}))

import { ProductForm } from "@/app/(protected)/products/product-form"
import { tokenStorage } from "@/lib/api"
import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
    replaceMock.mockReset()
})

const ING_1 = "11111111-1111-1111-1111-111111111111"
const ING_2 = "22222222-2222-2222-2222-222222222222"
const CAT_1 = "33333333-3333-3333-3333-333333333333"

function meHandler() {
    return {
        status: 200,
        data: {
            data: {
                id: "u1",
                name: "Ana",
                email: "a@x.com",
                role: "OWNER",
                active: true,
                createdAt: "2026-01-01T00:00:00Z",
            },
        },
    }
}

function selectsHandler(cfg: { url?: string; method?: string }) {
    const url = cfg.url ?? ""
    if (url.endsWith("/users/me")) return meHandler()
    if (url.includes("/ingredients")) {
        return {
            status: 200,
            data: {
                data: [
                    {
                        id: ING_1,
                        name: "Mussarela",
                        description: null,
                        categoryId: "c1",
                        unitOfMeasure: "kg",
                        minimumQty: 5,
                        averageCost: 30,
                        expiryDate: null,
                        defaultSupplierId: null,
                        active: true,
                        createdAt: "2026-01-01T00:00:00Z",
                    },
                    {
                        id: ING_2,
                        name: "Manjericão",
                        description: null,
                        categoryId: "c1",
                        unitOfMeasure: "g",
                        minimumQty: 1,
                        averageCost: 5,
                        expiryDate: null,
                        defaultSupplierId: null,
                        active: true,
                        createdAt: "2026-01-01T00:00:00Z",
                    },
                ],
                page: 0,
                size: 1000,
                total: 2,
            },
        }
    }
    if (url.includes("/categories")) {
        return {
            status: 200,
            data: {
                data: [
                    {
                        id: CAT_1,
                        name: "Pizzas",
                        description: null,
                        createdAt: "2026-01-01T00:00:00Z",
                    },
                ],
                page: 0,
                size: 1000,
                total: 1,
            },
        }
    }
    return null
}

describe("ProductForm (create)", () => {
    it("renders, fills in fields, submits valid product", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            const url = cfg.url ?? ""
            if (url.endsWith("/products") && cfg.method === "post") {
                return { status: 201, data: { data: { id: "p1" } } }
            }
            return { status: 500 }
        })

        renderWithProviders(<ProductForm mode="create" />)

        await waitFor(() => expect(screen.getByText("Mussarela")).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Margherita" } })
        fireEvent.change(screen.getByLabelText(/preço/i), { target: { value: "45.9" } })

        const ingredientsBlock = screen.getByTestId("prod-ingredients")
        const firstRow = within(ingredientsBlock).getAllByTestId("prod-ingredient-row")[0]

        fireEvent.change(within(firstRow).getByLabelText(/ingrediente/i), {
            target: { value: ING_1 },
        })

        await waitFor(() =>
            expect((within(firstRow).getByLabelText(/^unidade$/i) as HTMLInputElement).value).toBe("kg")
        )

        fireEvent.change(within(firstRow).getByLabelText(/quantidade/i), {
            target: { value: "0.3" },
        })

        fireEvent.click(screen.getByRole("button", { name: /salvar/i }))

        await waitFor(() => {
            const post = getCalls().find(
                (c) => c.method === "post" && c.url?.endsWith("/products")
            )
            expect(post).toBeTruthy()
        })
    })

    it("rejects duplicated ingredients", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            return { status: 500 }
        })

        renderWithProviders(<ProductForm mode="create" />)
        await waitFor(() => expect(screen.getByText("Mussarela")).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Margherita" } })
        fireEvent.change(screen.getByLabelText(/preço/i), { target: { value: "45.9" } })

        // Add a second row
        fireEvent.click(screen.getByRole("button", { name: /adicionar ingrediente/i }))

        const ingredientsBlock = screen.getByTestId("prod-ingredients")
        const rows = within(ingredientsBlock).getAllByTestId("prod-ingredient-row")
        expect(rows).toHaveLength(2)

        fireEvent.change(within(rows[0]).getByLabelText(/ingrediente/i), {
            target: { value: ING_1 },
        })
        fireEvent.change(within(rows[0]).getByLabelText(/quantidade/i), {
            target: { value: "0.3" },
        })
        fireEvent.change(within(rows[1]).getByLabelText(/ingrediente/i), {
            target: { value: ING_1 },
        })
        fireEvent.change(within(rows[1]).getByLabelText(/quantidade/i), {
            target: { value: "0.2" },
        })

        fireEvent.click(screen.getByRole("button", { name: /salvar/i }))

        await waitFor(() => {
            expect(screen.getByText(/duplicad/i)).toBeInTheDocument()
        })
        const post = getCalls().find((c) => c.method === "post" && c.url?.endsWith("/products"))
        expect(post).toBeFalsy()
    })

    it("disables remove button when only one row", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            return { status: 500 }
        })

        renderWithProviders(<ProductForm mode="create" />)
        await waitFor(() => expect(screen.getByText("Mussarela")).toBeInTheDocument())

        const ingredientsBlock = screen.getByTestId("prod-ingredients")
        const removeBtn = within(ingredientsBlock).queryByRole("button", {
            name: /remover item da ficha/i,
        })
        expect(removeBtn).toBeDisabled()
    })
})
