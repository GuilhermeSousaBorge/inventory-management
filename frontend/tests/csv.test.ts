import { describe, expect, it, vi } from "vitest"

import { downloadCsv, toCsv } from "@/lib/csv"

describe("toCsv", () => {
    it("prefixes BOM and joins headers with `;`", () => {
        const out = toCsv(["A", "B"], [])
        expect(out.startsWith("﻿")).toBe(true)
        expect(out.slice(1)).toBe("A;B")
    })

    it("formats numbers in pt-BR", () => {
        const out = toCsv(["Total"], [[1234.56]])
        expect(out).toContain("1.234,56")
    })

    it("escapes cells containing `;`, `\"`, newline", () => {
        const out = toCsv(["X"], [["a;b"], ['he said "hi"'], ["line1\nline2"]])
        expect(out).toContain('"a;b"')
        expect(out).toContain('"he said ""hi"""')
        expect(out).toContain('"line1\nline2"')
    })

    it("uses CRLF between rows", () => {
        const out = toCsv(["A"], [["1"], ["2"]])
        expect(out.slice(1)).toBe("A\r\n1\r\n2")
    })
})

describe("downloadCsv", () => {
    it("creates a temporary anchor and clicks it", () => {
        const createObjectURL = vi.fn(() => "blob:mock")
        const revokeObjectURL = vi.fn()
        Object.defineProperty(window.URL, "createObjectURL", { value: createObjectURL, writable: true })
        Object.defineProperty(window.URL, "revokeObjectURL", { value: revokeObjectURL, writable: true })
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

        downloadCsv("test.csv", "A;B")

        expect(createObjectURL).toHaveBeenCalledTimes(1)
        expect(click).toHaveBeenCalledTimes(1)
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock")
        click.mockRestore()
    })
})