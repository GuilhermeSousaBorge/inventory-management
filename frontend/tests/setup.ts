import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

if (typeof Element.prototype.hasPointerCapture !== "function") {
    Element.prototype.hasPointerCapture = function() { return false }
}

if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = function() {}
}

afterEach(() => {
    cleanup()
})
