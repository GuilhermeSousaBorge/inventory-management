import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ConsumptionReportPage from "@/app/(protected)/reports/consumption/page"
import ReportsHubPage from "@/app/(protected)/reports/page"
import StockStatusReportPage from "@/app/(protected)/reports/stock-status/page"

import { getCalls, renderWithProviders, resetMockApi, setHandler } from "./helpers"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/reports",
    useParams: () => ({}),
}))

beforeEach(() => resetMockApi())
afterEach(() => resetMockApi())

describe("/reports hub", () => {
    it("renders 4 cards linking to subroutes", () => {
        renderWithProviders(<ReportsHubPage />)
        expect(screen.getByText("Consumo")).toBeInTheDocument()
        expect(screen.getByText("Vendas")).toBeInTheDocument()
        expect(screen.getByText("Desperdício")).toBeInTheDocument()
        expect(screen.getByText("Status de estoque")).toBeInTheDocument()
    })
})

describe("/reports/consumption", () => {
    it("renders initial state until Apply is clicked", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderWithProviders(<ConsumptionReportPage />)
        expect(
            screen.getByText("Selecione um período e clique em Aplicar."),
        ).toBeInTheDocument()
        // not yet fetched
        const reportCalls = getCalls().filter((c) =>
            c.url?.startsWith("/reports/"),
        )
        expect(reportCalls.length).toBe(0)
    })

    it("after Apply, renders KPIs and table from data", async () => {
        setHandler((cfg) => {
            if (cfg.url === "/reports/consumption") {
                return {
                    status: 200,
                    data: {
                        data: [
                            {
                                ingredientId: "i-1",
                                ingredientName: "Mozzarella",
                                unitOfMeasure: "kg",
                                totalQuantity: 12.5,
                                movementCount: 4,
                            },
                        ],
                    },
                }
            }
            return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
        })
        renderWithProviders(<ConsumptionReportPage />)
        fireEvent.click(screen.getByText("Aplicar"))
        await waitFor(() =>
            expect(screen.getAllByText("Mozzarella").length).toBeGreaterThan(0),
        )
        expect(screen.getAllByText("Total geral").length).toBeGreaterThan(0)
    })
})

describe("/reports/stock-status", () => {
    it("does not require period — fetches immediately", async () => {
        setHandler((cfg) => {
            if (cfg.url === "/reports/stock-status") {
                return { status: 200, data: { data: [] } }
            }
            return { status: 200, data: { data: [], page: 0, size: 1000, total: 0 } }
        })
        renderWithProviders(<StockStatusReportPage />)
        await waitFor(() => {
            const c = getCalls().find((x) => x.url === "/reports/stock-status")
            expect(c).toBeDefined()
        })
    })
})

describe("ExportCsvButton inside reports", () => {
    it("is disabled when there is no data", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderWithProviders(<ConsumptionReportPage />)
        fireEvent.click(screen.getByText("Aplicar"))
        await waitFor(() => {
            const btn = screen.getByText("Exportar CSV").closest("button")
            expect(btn).toBeDisabled()
        })
    })
})