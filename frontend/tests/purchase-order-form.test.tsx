import { fireEvent, screen, waitFor, within } from "@testing-library/react"
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

describe("PurchaseOrderForm (create)", () => {
    it("renders, adds an item, prefills unitPrice, computes total, submits", async () => {
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

        // wait for selects to populate
        await waitFor(() => expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText(/fornecedor/i), { target: { value: supplierUUID } })
        fireEvent.change(screen.getByLabelText(/unidade/i), { target: { value: unitUUID } })

        // first item is auto-rendered (one default empty row)
        const itemsBlock = screen.getByTestId("po-items")
        const firstRow = within(itemsBlock).getAllByTestId("po-item-row")[0]

        // pick ingredient
        fireEvent.change(within(firstRow).getByLabelText(/ingrediente/i), {
            target: { value: ingredientUUID },
        })

        // unitPrice is auto-populated with averageCost (23.5)
        await waitFor(() =>
            expect((within(firstRow).getByLabelText(/preço/i) as HTMLInputElement).value).toBe("23.5")
        )

        // qty
        fireEvent.change(within(firstRow).getByLabelText(/quantidade/i), { target: { value: "2" } })

        // total = 2 * 23.5 = 47
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

        // remove the only row
        const itemsBlock = screen.getByTestId("po-items")
        const removeBtn = within(itemsBlock).queryByRole("button", { name: /remover item/i })
        // remove may be disabled when there's only 1 row — check
        expect(removeBtn).toBeDisabled()
    })
})