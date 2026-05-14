import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replaceMock = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/purchase-orders/nova",
}))

import { PurchaseOrderForm } from "@/app/(protected)/purchase-orders/purchase-order-form"
import { tokenStorage } from "@/lib/api"
import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

beforeEach(() => {
    resetMockApi()
    replaceMock.mockReset()
})

const supplierUUID = "11111111-1111-1111-1111-111111111111"
const unitUUID = "22222222-2222-2222-2222-222222222222"
const ingredientUUID = "33333333-3333-3333-3333-333333333333"

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
    if (url.includes("/suppliers")) {
        return {
            status: 200,
            data: {
                data: [
                    {
                        id: supplierUUID,
                        name: "Distribuidora ABC",
                        contactName: null,
                        phone: null,
                        email: null,
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
    if (url.includes("/units")) {
        return {
            status: 200,
            data: {
                data: [{ id: unitUUID, name: "Centro", address: null, active: true, createdAt: "2026-01-01T00:00:00Z" }],
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
                        id: ingredientUUID,
                        name: "Mussarela",
                        description: null,
                        categoryId: "c1",
                        unitOfMeasure: "kg",
                        minimumQty: 5,
                        averageCost: 23.5,
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
    return null
}

async function pickFirstIngredient(row: HTMLElement) {
    const user = userEvent.setup()
    const trigger = within(row).getByRole("combobox", { name: /ingrediente/i })
    await user.click(trigger)
    await waitFor(() => {
        const content = document.body.querySelector('[data-slot="select-content"]')
        expect(content).toBeInTheDocument()
    })
    const items = document.body.querySelectorAll('[data-slot="select-item"]')
    expect(items.length).toBeGreaterThan(0)
    await user.click(items[0])
}

describe("PurchaseOrderForm (create)", () => {
    it("renders, adds an item, prefills unitPrice, computes total, submits", async () => {
        const user = userEvent.setup()
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            const url = cfg.url ?? ""
            if (url.endsWith("/purchase-orders") && cfg.method === "post") {
                return { status: 201, data: { data: { id: "po1" } } }
            }
            return { status: 500 }
        })

        renderWithProviders(<PurchaseOrderForm mode="create" />)

        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())

        const supplierTrigger = screen.getByRole("combobox", { name: /fornecedor/i })
        await user.click(supplierTrigger)
        await waitFor(() => {
            const content = document.body.querySelector('[data-slot="select-content"]')
            expect(content).toBeInTheDocument()
        })
        await user.click(document.body.querySelector('[data-slot="select-content"] [data-slot="select-item"]')!)

        const unitTrigger = screen.getByRole("combobox", { name: /unidade/i })
        await user.click(unitTrigger)
        await waitFor(() => {
            const content = document.body.querySelector('[data-slot="select-content"]')
            expect(content).toBeInTheDocument()
        })
        await user.click(document.body.querySelector('[data-slot="select-content"] [data-slot="select-item"]')!)

        const itemsBlock = screen.getByTestId("po-items")
        const firstRow = within(itemsBlock).getAllByTestId("po-item-row")[0]

        await pickFirstIngredient(firstRow)

        await waitFor(() =>
            expect((within(firstRow).getByLabelText(/preço/i) as HTMLInputElement).value).toBe("23.5")
        )

        fireEvent.change(within(firstRow).getByLabelText(/quantidade/i), { target: { value: "2" } })

        await waitFor(() => expect(screen.getByTestId("po-total").textContent).toMatch(/47/))

        fireEvent.click(screen.getByRole("button", { name: /salvar/i }))

        await waitFor(() => {
            const post = getCalls().find((c) => c.method === "post" && c.url?.endsWith("/purchase-orders"))
            expect(post).toBeTruthy()
        })
    })

    it("rejects empty items list", async () => {
        tokenStorage.setAccess("a1")
        setHandler((cfg) => {
            const r = selectsHandler(cfg)
            if (r) return r
            return { status: 500 }
        })

        renderWithProviders(<PurchaseOrderForm mode="create" />)
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())

        const itemsBlock = screen.getByTestId("po-items")
        const removeBtn = within(itemsBlock).queryByRole("button", { name: /remover item/i })
        expect(removeBtn).toBeDisabled()
    })
})