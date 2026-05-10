import { describe, expect, it } from "vitest"

import { createCategorySchema, updateCategorySchema } from "@/lib/categories"
import { createIngredientSchema, UNITS_OF_MEASURE, updateIngredientSchema } from "@/lib/ingredients"
import { createOrderSchema } from "@/lib/orders"
import { createProductSchema } from "@/lib/products"
import { createPurchaseOrderSchema } from "@/lib/purchase-orders"
import { reportsRangeFiltersSchema } from "@/lib/reports"
import { createAdjustmentSchema } from "@/lib/stock-movements"
import { createSupplierSchema, updateSupplierSchema } from "@/lib/suppliers"
import { createUnitSchema, updateUnitSchema } from "@/lib/units"
import { changePasswordSchema, createUserSchema, updateUserSchema } from "@/lib/users"

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

describe("createSupplierSchema", () => {
    it("accepts only name (other fields empty)", () => {
        const r = createSupplierSchema.safeParse({
            name: "Distribuidora ABC",
            contactName: "",
            phone: "",
            email: "",
            address: "",
        })
        expect(r.success).toBe(true)
    })

    it("accepts a full payload", () => {
        const r = createSupplierSchema.safeParse({
            name: "Distribuidora ABC",
            contactName: "João",
            phone: "(11) 99999-9999",
            email: "joao@abc.com",
            address: "R. das Flores, 123",
        })
        expect(r.success).toBe(true)
    })

    it("rejects empty name", () => {
        const r = createSupplierSchema.safeParse({
            name: "",
            contactName: "",
            phone: "",
            email: "",
            address: "",
        })
        expect(r.success).toBe(false)
    })

    it("rejects invalid email", () => {
        const r = createSupplierSchema.safeParse({
            name: "ABC",
            contactName: "",
            phone: "",
            email: "not-an-email",
            address: "",
        })
        expect(r.success).toBe(false)
    })

    it("accepts empty email (optional)", () => {
        const r = createSupplierSchema.safeParse({
            name: "ABC",
            contactName: "",
            phone: "",
            email: "",
            address: "",
        })
        expect(r.success).toBe(true)
    })
})

describe("updateSupplierSchema", () => {
    it("requires active flag", () => {
        const r = updateSupplierSchema.safeParse({
            name: "ABC",
            contactName: "",
            phone: "",
            email: "",
            address: "",
        })
        expect(r.success).toBe(false)
    })

    it("accepts active flag", () => {
        const r = updateSupplierSchema.safeParse({
            name: "ABC",
            contactName: "",
            phone: "",
            email: "",
            address: "",
            active: true,
        })
        expect(r.success).toBe(true)
    })
})

describe("createIngredientSchema", () => {
    const validBase = {
        name: "Mussarela",
        description: "",
        categoryId: "11111111-1111-1111-1111-111111111111",
        unitOfMeasure: "kg",
        minimumQty: 5,
        expiryDate: "",
        defaultSupplierId: "",
    }

    it("accepts a minimal valid input", () => {
        const r = createIngredientSchema.safeParse(validBase)
        expect(r.success).toBe(true)
    })

    it("accepts every unit_of_measure", () => {
        for (const unit of UNITS_OF_MEASURE) {
            const r = createIngredientSchema.safeParse({ ...validBase, unitOfMeasure: unit })
            expect(r.success).toBe(true)
        }
    })

    it("rejects unknown unit_of_measure", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, unitOfMeasure: "lb" })
        expect(r.success).toBe(false)
    })

    it("rejects negative minimumQty", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, minimumQty: -1 })
        expect(r.success).toBe(false)
    })

    it("coerces minimumQty from string", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, minimumQty: "5.5" })
        expect(r.success).toBe(true)
    })

    it("rejects empty name", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, name: "" })
        expect(r.success).toBe(false)
    })

    it("rejects categoryId that is not a UUID", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, categoryId: "not-a-uuid" })
        expect(r.success).toBe(false)
    })

    it("accepts empty defaultSupplierId (optional)", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, defaultSupplierId: "" })
        expect(r.success).toBe(true)
    })

    it("accepts a valid UUID for defaultSupplierId", () => {
        const r = createIngredientSchema.safeParse({
            ...validBase,
            defaultSupplierId: "22222222-2222-2222-2222-222222222222",
        })
        expect(r.success).toBe(true)
    })

    it("accepts empty expiryDate", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, expiryDate: "" })
        expect(r.success).toBe(true)
    })

    it("accepts a valid ISO date for expiryDate", () => {
        const r = createIngredientSchema.safeParse({ ...validBase, expiryDate: "2026-12-31" })
        expect(r.success).toBe(true)
    })
})

describe("updateIngredientSchema", () => {
    it("requires active", () => {
        const r = updateIngredientSchema.safeParse({
            name: "Mussarela",
            description: "",
            categoryId: "11111111-1111-1111-1111-111111111111",
            unitOfMeasure: "kg",
            minimumQty: 5,
            expiryDate: "",
            defaultSupplierId: "",
        })
        expect(r.success).toBe(false)
    })

    it("accepts active flag", () => {
        const r = updateIngredientSchema.safeParse({
            name: "Mussarela",
            description: "",
            categoryId: "11111111-1111-1111-1111-111111111111",
            unitOfMeasure: "kg",
            minimumQty: 5,
            expiryDate: "",
            defaultSupplierId: "",
            active: true,
        })
        expect(r.success).toBe(true)
    })
})

describe("createAdjustmentSchema", () => {
    const validBase = {
        ingredientId: "11111111-1111-1111-1111-111111111111",
        unitId: "22222222-2222-2222-2222-222222222222",
        quantity: 5,
        direction: "INCREASE" as const,
        reason: "Sobra de evento",
    }

    it("accepts a minimal valid input", () => {
        const r = createAdjustmentSchema.safeParse(validBase)
        expect(r.success).toBe(true)
    })

    it("accepts both directions", () => {
        for (const d of ["INCREASE", "DECREASE"]) {
            const r = createAdjustmentSchema.safeParse({ ...validBase, direction: d })
            expect(r.success).toBe(true)
        }
    })

    it("rejects unknown direction", () => {
        const r = createAdjustmentSchema.safeParse({ ...validBase, direction: "OTHER" })
        expect(r.success).toBe(false)
    })

    it("rejects non-positive quantity", () => {
        expect(createAdjustmentSchema.safeParse({ ...validBase, quantity: 0 }).success).toBe(false)
        expect(createAdjustmentSchema.safeParse({ ...validBase, quantity: -1 }).success).toBe(false)
    })

    it("coerces quantity from string", () => {
        const r = createAdjustmentSchema.safeParse({ ...validBase, quantity: "5.5" })
        expect(r.success).toBe(true)
    })

    it("rejects empty reason", () => {
        const r = createAdjustmentSchema.safeParse({ ...validBase, reason: "" })
        expect(r.success).toBe(false)
    })

    it("rejects reason > 255 chars", () => {
        const r = createAdjustmentSchema.safeParse({ ...validBase, reason: "x".repeat(256) })
        expect(r.success).toBe(false)
    })

    it("rejects non-uuid ingredientId/unitId", () => {
        expect(createAdjustmentSchema.safeParse({ ...validBase, ingredientId: "no" }).success).toBe(false)
        expect(createAdjustmentSchema.safeParse({ ...validBase, unitId: "no" }).success).toBe(false)
    })
})

describe("createPurchaseOrderSchema", () => {
    const validBase = {
        supplierId: "11111111-1111-1111-1111-111111111111",
        unitId: "22222222-2222-2222-2222-222222222222",
        expectedAt: "",
        notes: "",
        items: [
            {
                ingredientId: "33333333-3333-3333-3333-333333333333",
                quantity: 5,
                unitPrice: 10,
            },
        ],
    }

    it("accepts a minimal valid input", () => {
        const r = createPurchaseOrderSchema.safeParse(validBase)
        expect(r.success).toBe(true)
    })

    it("rejects when items is empty", () => {
        const r = createPurchaseOrderSchema.safeParse({ ...validBase, items: [] })
        expect(r.success).toBe(false)
    })

    it("rejects duplicate ingredients in items", () => {
        const r = createPurchaseOrderSchema.safeParse({
            ...validBase,
            items: [
                { ingredientId: "33333333-3333-3333-3333-333333333333", quantity: 1, unitPrice: 1 },
                { ingredientId: "33333333-3333-3333-3333-333333333333", quantity: 2, unitPrice: 2 },
            ],
        })
        expect(r.success).toBe(false)
    })

    it("rejects non-positive quantity in item", () => {
        const r = createPurchaseOrderSchema.safeParse({
            ...validBase,
            items: [
                { ingredientId: "33333333-3333-3333-3333-333333333333", quantity: 0, unitPrice: 1 },
            ],
        })
        expect(r.success).toBe(false)
    })

    it("rejects non-positive unitPrice in item", () => {
        const r = createPurchaseOrderSchema.safeParse({
            ...validBase,
            items: [
                { ingredientId: "33333333-3333-3333-3333-333333333333", quantity: 1, unitPrice: 0 },
            ],
        })
        expect(r.success).toBe(false)
    })

    it("accepts valid expectedAt", () => {
        const r = createPurchaseOrderSchema.safeParse({ ...validBase, expectedAt: "2026-12-31" })
        expect(r.success).toBe(true)
    })

    it("rejects invalid expectedAt", () => {
        const r = createPurchaseOrderSchema.safeParse({ ...validBase, expectedAt: "31/12/2026" })
        expect(r.success).toBe(false)
    })

    it("rejects notes > 500 chars", () => {
        const r = createPurchaseOrderSchema.safeParse({ ...validBase, notes: "x".repeat(501) })
        expect(r.success).toBe(false)
    })

    it("rejects non-uuid supplierId/unitId", () => {
        expect(createPurchaseOrderSchema.safeParse({ ...validBase, supplierId: "no" }).success).toBe(false)
        expect(createPurchaseOrderSchema.safeParse({ ...validBase, unitId: "no" }).success).toBe(false)
    })
})

describe("createProductSchema", () => {
    const VALID_UUID = "11111111-1111-1111-1111-111111111111"
    const VALID_UUID_2 = "22222222-2222-2222-2222-222222222222"

    function baseInput() {
        return {
            name: "Margherita",
            size: "G" as const,
            categoryId: VALID_UUID,
            price: 45.9,
            description: "Molho de tomate",
            ingredients: [{ ingredientId: VALID_UUID, quantity: 0.3 }],
        }
    }

    it("accepts a valid product with one ingredient", () => {
        const result = createProductSchema.safeParse(baseInput())
        expect(result.success).toBe(true)
    })

    it("rejects empty ingredients array", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), ingredients: [] })
        expect(result.success).toBe(false)
    })

    it("rejects duplicated ingredient ids", () => {
        const result = createProductSchema.safeParse({
            ...baseInput(),
            ingredients: [
                { ingredientId: VALID_UUID, quantity: 0.3 },
                { ingredientId: VALID_UUID, quantity: 0.2 },
            ],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((i) => /duplicad/i.test(i.message))).toBe(true)
        }
    })

    it("accepts two distinct ingredients", () => {
        const result = createProductSchema.safeParse({
            ...baseInput(),
            ingredients: [
                { ingredientId: VALID_UUID, quantity: 0.3 },
                { ingredientId: VALID_UUID_2, quantity: 0.2 },
            ],
        })
        expect(result.success).toBe(true)
    })

    it("rejects empty name", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), name: "" })
        expect(result.success).toBe(false)
    })

    it("rejects price <= 0", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), price: 0 })
        expect(result.success).toBe(false)
    })

    it("rejects size outside enum", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), size: "XL" as never })
        expect(result.success).toBe(false)
    })

    it("rejects description above 255 chars", () => {
        const result = createProductSchema.safeParse({
            ...baseInput(),
            description: "x".repeat(256),
        })
        expect(result.success).toBe(false)
    })

    it("accepts empty categoryId (optional)", () => {
        const result = createProductSchema.safeParse({ ...baseInput(), categoryId: "" })
        expect(result.success).toBe(true)
    })

    it("rejects ingredient quantity <= 0", () => {
        const result = createProductSchema.safeParse({
            ...baseInput(),
            ingredients: [{ ingredientId: VALID_UUID, quantity: 0 }],
        })
        expect(result.success).toBe(false)
    })
})

describe("createOrderSchema", () => {
    const VALID_UUID = "11111111-1111-1111-1111-111111111111"
    const VALID_UUID_2 = "22222222-2222-2222-2222-222222222222"
    const UNIT_UUID = "33333333-3333-3333-3333-333333333333"

    function baseInput() {
        return {
            unitId: UNIT_UUID,
            notes: "",
            items: [{ productId: VALID_UUID, quantity: 1 }],
        }
    }

    it("accepts a valid order with one item", () => {
        const result = createOrderSchema.safeParse(baseInput())
        expect(result.success).toBe(true)
    })

    it("rejects empty items array", () => {
        const result = createOrderSchema.safeParse({ ...baseInput(), items: [] })
        expect(result.success).toBe(false)
    })

    it("rejects duplicated product ids", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            items: [
                { productId: VALID_UUID, quantity: 1 },
                { productId: VALID_UUID, quantity: 2 },
            ],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((i) => /duplicad/i.test(i.message))).toBe(true)
        }
    })

    it("accepts two distinct products", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            items: [
                { productId: VALID_UUID, quantity: 1 },
                { productId: VALID_UUID_2, quantity: 1 },
            ],
        })
        expect(result.success).toBe(true)
    })

    it("rejects quantity 0", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            items: [{ productId: VALID_UUID, quantity: 0 }],
        })
        expect(result.success).toBe(false)
    })

    it("rejects non-integer quantity", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            items: [{ productId: VALID_UUID, quantity: 1.5 }],
        })
        expect(result.success).toBe(false)
    })

    it("rejects notes above 500 chars", () => {
        const result = createOrderSchema.safeParse({
            ...baseInput(),
            notes: "x".repeat(501),
        })
        expect(result.success).toBe(false)
    })
})

describe("reportsRangeFiltersSchema", () => {
    const valid = {
        from: "2026-05-01",
        to: "2026-05-07",
        unit: "550e8400-e29b-41d4-a716-446655440000",
    }

    it("accepts valid input with optional unit", () => {
        const r = reportsRangeFiltersSchema.safeParse(valid)
        expect(r.success).toBe(true)
    })

    it("accepts empty optional fields", () => {
        const r = reportsRangeFiltersSchema.safeParse({
            from: "2026-05-01",
            to: "2026-05-07",
        })
        expect(r.success).toBe(true)
    })

    it("rejects from > to", () => {
        const r = reportsRangeFiltersSchema.safeParse({
            from: "2026-05-10",
            to: "2026-05-07",
        })
        expect(r.success).toBe(false)
        if (!r.success) {
            expect(r.error.issues[0]?.path).toEqual(["to"])
        }
    })

    it("rejects empty from/to", () => {
        const r = reportsRangeFiltersSchema.safeParse({ from: "", to: "" })
        expect(r.success).toBe(false)
    })

    it("rejects invalid UUID in optional unit", () => {
        const r = reportsRangeFiltersSchema.safeParse({
            ...valid,
            unit: "not-a-uuid",
        })
        expect(r.success).toBe(false)
    })
})