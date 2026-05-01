import { describe, expect, it } from "vitest"

import { changePasswordSchema, createUserSchema, updateUserSchema } from "@/lib/users"
import { createUnitSchema, updateUnitSchema } from "@/lib/units"
import { createCategorySchema, updateCategorySchema } from "@/lib/categories"

describe("createUserSchema", () => {
    it("accepts a valid input", () => {
        const r = createUserSchema.safeParse({
            name: "Ana Gomes",
            email: "ana@pizzaria.com",
            password: "secret123",
            role: "EMPLOYEE",
        })
        expect(r.success).toBe(true)
    })

    it("rejects empty name", () => {
        const r = createUserSchema.safeParse({
            name: "",
            email: "a@b.com",
            password: "secret123",
            role: "EMPLOYEE",
        })
        expect(r.success).toBe(false)
    })

    it("rejects invalid email", () => {
        const r = createUserSchema.safeParse({
            name: "Ana",
            email: "no-at-sign",
            password: "secret123",
            role: "EMPLOYEE",
        })
        expect(r.success).toBe(false)
    })

    it("rejects short password", () => {
        const r = createUserSchema.safeParse({
            name: "Ana",
            email: "a@b.com",
            password: "12345",
            role: "EMPLOYEE",
        })
        expect(r.success).toBe(false)
    })

    it("rejects unknown role", () => {
        const r = createUserSchema.safeParse({
            name: "Ana",
            email: "a@b.com",
            password: "secret123",
            role: "ADMIN",
        })
        expect(r.success).toBe(false)
    })
})

describe("updateUserSchema", () => {
    it("accepts active true/false", () => {
        const ok = updateUserSchema.safeParse({
            name: "Ana",
            email: "a@b.com",
            role: "OWNER",
            active: true,
        })
        expect(ok.success).toBe(true)
    })

    it("rejects when active is missing", () => {
        const r = updateUserSchema.safeParse({
            name: "Ana",
            email: "a@b.com",
            role: "OWNER",
        })
        expect(r.success).toBe(false)
    })
})

describe("changePasswordSchema", () => {
    it("requires confirmPassword to match newPassword", () => {
        const r = changePasswordSchema.safeParse({
            currentPassword: "old123",
            newPassword: "newpass1",
            confirmPassword: "different",
        })
        expect(r.success).toBe(false)
        if (!r.success) {
            const confirmIssue = r.error.issues.find((i) => i.path[0] === "confirmPassword")
            expect(confirmIssue?.message).toBe("As senhas não coincidem")
        }
    })

    it("accepts when both match and meet length", () => {
        const r = changePasswordSchema.safeParse({
            currentPassword: "old123",
            newPassword: "newpass1",
            confirmPassword: "newpass1",
        })
        expect(r.success).toBe(true)
    })

    it("rejects newPassword shorter than 6", () => {
        const r = changePasswordSchema.safeParse({
            currentPassword: "old",
            newPassword: "abc",
            confirmPassword: "abc",
        })
        expect(r.success).toBe(false)
    })
})

describe("createUnitSchema", () => {
    it("accepts a name with empty address", () => {
        const r = createUnitSchema.safeParse({ name: "Centro", address: "" })
        expect(r.success).toBe(true)
    })

    it("accepts a name with valid address", () => {
        const r = createUnitSchema.safeParse({
            name: "Centro",
            address: "R. das Flores, 123",
        })
        expect(r.success).toBe(true)
    })

    it("rejects empty name", () => {
        const r = createUnitSchema.safeParse({ name: "", address: "" })
        expect(r.success).toBe(false)
    })

    it("rejects address > 255 chars", () => {
        const r = createUnitSchema.safeParse({
            name: "Centro",
            address: "x".repeat(256),
        })
        expect(r.success).toBe(false)
    })
})

describe("updateUnitSchema", () => {
    it("requires active flag", () => {
        const r = updateUnitSchema.safeParse({ name: "Centro", address: "" })
        expect(r.success).toBe(false)
    })

    it("accepts active flag", () => {
        const r = updateUnitSchema.safeParse({ name: "Centro", address: "", active: false })
        expect(r.success).toBe(true)
    })
})

describe("createCategorySchema", () => {
    it("accepts a name with empty description", () => {
        const r = createCategorySchema.safeParse({ name: "Massas", description: "" })
        expect(r.success).toBe(true)
    })

    it("accepts a name with valid description", () => {
        const r = createCategorySchema.safeParse({
            name: "Massas",
            description: "Farinhas e variações",
        })
        expect(r.success).toBe(true)
    })

    it("rejects empty name", () => {
        const r = createCategorySchema.safeParse({ name: "", description: "" })
        expect(r.success).toBe(false)
    })

    it("rejects name > 100 chars", () => {
        const r = createCategorySchema.safeParse({
            name: "x".repeat(101),
            description: "",
        })
        expect(r.success).toBe(false)
    })

    it("rejects description > 255 chars", () => {
        const r = createCategorySchema.safeParse({
            name: "Massas",
            description: "x".repeat(256),
        })
        expect(r.success).toBe(false)
    })
})

describe("updateCategorySchema", () => {
    it("has the same shape as create", () => {
        const r = updateCategorySchema.safeParse({ name: "Massas", description: "" })
        expect(r.success).toBe(true)
    })
})
