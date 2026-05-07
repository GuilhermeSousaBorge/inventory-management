import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replaceMock = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/orders/novo",
}))

import { OrderForm } from "@/app/(protected)/orders/order-form"
import { tokenStorage } from "@/lib/api"
import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
    replaceMock.mockReset()
})

const PROD_1 = "11111111-1111-1111-1111-111111111111"
const PROD_2 = "22222222-2222-2222-2222-222222222222"
const UNIT_1 = "33333333-3333-3333-3333-333333333333"

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
    if (url.includes("/products")) {
        return {
            status: 200,
            data: {
                data: [
                    {
                        id: PROD_1,
                        name: "Margherita",
                        size: "G",
                        categoryId: null,
                        categoryName: null,
                        price: 45.9,
                        description: null,
                        active: true,
                        createdAt: "2026-01-01T00:00:00Z",
                        ingredients: [],
                    },
                    {
                        id: PROD_2,
                        name: "Calabresa",
                        size: "M",
                        categoryId: null,
                        categoryName: null,
                        price: 39.9,
                        description: null,
                        active: true,
                        createdAt: "2026-01-01T00:00:00Z",
                        ingredients: [],
                    },
                ],
                page: 0,
                pageSize: 1000,
                total: 2,
            },
        }
    }
    if (url.includes("/units")) {
        return {
            status: 200,
            data: {
                data: [
                    {
                        id: UNIT_1,
                        name: "Centro",
                        address: null,
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
    return null
}

describe("OrderForm (create)", () => {
    it("renders, picks unit and product, computes total, submits without unitPrice", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            const url = cfg.url ?? ""
            if (url.endsWith("/orders") && cfg.method === "post") {
                return { status: 201, data: { data: { id: "o1" } } }
            }
            return { status: 500 }
        })

        renderWithProviders(<OrderForm mode="create" />)
        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText(/unidade/i), { target: { value: UNIT_1 } })

        const itemsBlock = screen.getByTestId("ord-items")
        const firstRow = within(itemsBlock).getAllByTestId("ord-item-row")[0]

        fireEvent.change(within(firstRow).getByLabelText(/produto/i), {
            target: { value: PROD_1 },
        })
        fireEvent.change(within(firstRow).getByLabelText(/quantidade/i), {
            target: { value: "2" },
        })

        await waitFor(() =>
            expect(screen.getByTestId("ord-total").textContent).toMatch(/91\.80/),
        )

        fireEvent.click(screen.getByRole("button", { name: /salvar/i }))

        await waitFor(() => {
            const post = getCalls().find(
                (c) => c.method === "post" && c.url?.endsWith("/orders"),
            )
            expect(post).toBeTruthy()
            // body may be string-serialized by axios; parse if needed
            const raw = post?.data
            const body =
                typeof raw === "string"
                    ? (JSON.parse(raw) as {
                          unitId: string
                          items: { productId: string; quantity: number; unitPrice?: number }[]
                      })
                    : (raw as {
                          unitId: string
                          items: { productId: string; quantity: number; unitPrice?: number }[]
                      })
            expect(body.unitId).toBe(UNIT_1)
            expect(body.items).toHaveLength(1)
            expect(body.items[0].productId).toBe(PROD_1)
            expect(body.items[0].quantity).toBe(2)
            expect("unitPrice" in body.items[0]).toBe(false)
        })
    })

    it("rejects duplicated products", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            return { status: 500 }
        })

        renderWithProviders(<OrderForm mode="create" />)
        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText(/unidade/i), { target: { value: UNIT_1 } })
        fireEvent.click(screen.getByRole("button", { name: /adicionar item/i }))

        const itemsBlock = screen.getByTestId("ord-items")
        const rows = within(itemsBlock).getAllByTestId("ord-item-row")
        expect(rows).toHaveLength(2)

        fireEvent.change(within(rows[0]).getByLabelText(/produto/i), {
            target: { value: PROD_1 },
        })
        fireEvent.change(within(rows[1]).getByLabelText(/produto/i), {
            target: { value: PROD_1 },
        })

        fireEvent.click(screen.getByRole("button", { name: /salvar/i }))

        await waitFor(() => {
            expect(screen.getByText(/duplicad/i)).toBeInTheDocument()
        })
        const post = getCalls().find((c) => c.method === "post" && c.url?.endsWith("/orders"))
        expect(post).toBeFalsy()
    })

    it("disables remove button when only one row", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            return { status: 500 }
        })

        renderWithProviders(<OrderForm mode="create" />)
        await waitFor(() => expect(screen.getByText(/Margherita G/i)).toBeInTheDocument())

        const itemsBlock = screen.getByTestId("ord-items")
        const removeBtn = within(itemsBlock).queryByRole("button", {
            name: /remover item do pedido/i,
        })
        expect(removeBtn).toBeDisabled()
    })
})

describe("OrderForm (edit)", () => {
    const initial = {
        id: "o-existing-id",
        unitId: UNIT_1,
        unitName: "Centro",
        status: "PENDING" as const,
        totalPrice: 91.8,
        notes: "sem cebola",
        createdById: "u1",
        startedAt: null,
        completedAt: null,
        canceledAt: null,
        createdAt: "2026-04-01T00:00:00Z",
        items: [
            {
                id: "oi1",
                productId: PROD_1,
                productName: "Margherita G",
                quantity: 2,
                unitPrice: 45.9,
                subtotal: 91.8,
            },
        ],
    }

    it("pre-populates fields from initial", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            return { status: 500 }
        })

        renderWithProviders(<OrderForm mode="edit" initial={initial} />)

        // Notes is a text input — pre-populated immediately from initial
        await waitFor(() =>
            expect((screen.getByLabelText(/observações/i) as HTMLInputElement).value).toBe(
                "sem cebola",
            ),
        )
        // Quantity is a number input — also pre-populated from initial.items[0].quantity = 2
        const itemsBlock = screen.getByTestId("ord-items")
        const rows = within(itemsBlock).getAllByTestId("ord-item-row")
        expect(rows).toHaveLength(1)
        expect((within(rows[0]).getByLabelText(/quantidade/i) as HTMLInputElement).value).toBe("2")
    })

    it("submits as PUT and redirects to detail on edit", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            const url = cfg.url ?? ""
            if (url.endsWith(`/orders/${initial.id}`) && cfg.method === "put") {
                return { status: 200, data: { data: { id: initial.id } } }
            }
            return { status: 500 }
        })

        renderWithProviders(<OrderForm mode="edit" initial={initial} />)

        // Wait for the form to settle (notes input + unit option both ready)
        await waitFor(() =>
            expect((screen.getByLabelText(/observações/i) as HTMLInputElement).value).toBe(
                "sem cebola",
            ),
        )
        await waitFor(() => expect(screen.getByText("Centro")).toBeInTheDocument())

        const itemsBlock = screen.getByTestId("ord-items")
        const firstRow = within(itemsBlock).getAllByTestId("ord-item-row")[0]
        fireEvent.change(within(firstRow).getByLabelText(/quantidade/i), {
            target: { value: "3" },
        })

        fireEvent.click(screen.getByRole("button", { name: /salvar/i }))

        await waitFor(() => {
            const put = getCalls().find(
                (c) =>
                    (c.method ?? "").toLowerCase() === "put" &&
                    (c.url ?? "").endsWith(`/orders/${initial.id}`),
            )
            expect(put).toBeTruthy()
            expect(replaceMock).toHaveBeenCalledWith(`/orders/${initial.id}`)
        })
    })
})
