import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
    useConsumptionReport,
    useSalesReport,
    useStockStatusReport,
    useWasteReport,
} from "@/lib/reports"

import { createWrapper, getCalls, resetMockApi, setHandler } from "./helpers"

let wrapper: ReturnType<typeof createWrapper>

beforeEach(() => {
    resetMockApi()
    wrapper = createWrapper()
})
afterEach(() => resetMockApi())

describe("useConsumptionReport", () => {
    it("is disabled when from/to missing", () => {
        const { result } = renderHook(
            () => useConsumptionReport({ from: "", to: "" }),
            { wrapper },
        )
        expect(result.current.fetchStatus).toBe("idle")
        expect(getCalls().length).toBe(0)
    })

    it("sends from, to, unit, ingredient when present", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(
            () =>
                useConsumptionReport({
                    from: "2026-05-01",
                    to: "2026-05-07",
                    unit: "u-1",
                    ingredient: "i-1",
                }),
            { wrapper },
        )
        await waitFor(() => expect(getCalls().length).toBeGreaterThan(0))
        const params = getCalls()[0]?.params as Record<string, unknown>
        expect(params.from).toBe("2026-05-01")
        expect(params.to).toBe("2026-05-07")
        expect(params.unit).toBe("u-1")
        expect(params.ingredient).toBe("i-1")
    })
})

describe("useSalesReport", () => {
    it("sends product param", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(
            () =>
                useSalesReport({
                    from: "2026-05-01",
                    to: "2026-05-07",
                    product: "p-1",
                }),
            { wrapper },
        )
        await waitFor(() => expect(getCalls().length).toBeGreaterThan(0))
        expect(
            (getCalls()[0]?.params as Record<string, unknown>).product,
        ).toBe("p-1")
    })
})

describe("useWasteReport", () => {
    it("hits /reports/waste", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(
            () => useWasteReport({ from: "2026-05-01", to: "2026-05-07" }),
            { wrapper },
        )
        await waitFor(() => expect(getCalls()[0]?.url).toBe("/reports/waste"))
    })
})

describe("useStockStatusReport", () => {
    it("does not require date range", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(() => useStockStatusReport({}), { wrapper })
        await waitFor(() => expect(getCalls()[0]?.url).toBe("/reports/stock-status"))
    })

    it("sends unit when provided", async () => {
        setHandler(() => ({ status: 200, data: { data: [] } }))
        renderHook(() => useStockStatusReport({ unit: "u-1" }), { wrapper })
        await waitFor(() => expect(getCalls()[0]?.params).toBeDefined())
        expect(
            (getCalls()[0]?.params as Record<string, unknown>).unit,
        ).toBe("u-1")
    })
})