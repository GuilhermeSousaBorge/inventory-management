import { api } from "@/lib/api"
import type { Page } from "@/lib/users"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const PRODUCT_SIZES = ["P", "M", "G", "GG"] as const
export type ProductSize = (typeof PRODUCT_SIZES)[number]

export type ProductIngredient = {
    id: string
    ingredientId: string
    ingredientName: string
    quantity: number
    unitOfMeasure: string
}

export type Product = {
    id: string
    name: string
    size: ProductSize
    categoryId: string | null
    categoryName: string | null
    price: number
    description: string | null
    active: boolean
    createdAt: string
    ingredients: ProductIngredient[]
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const productIngredientSchema = z.object({
    ingredientId: z.string().regex(UUID_REGEX, "Selecione um ingrediente"),
    quantity: z.coerce.number().positive("Quantidade > 0"),
})
export type ProductIngredientInput = z.infer<typeof productIngredientSchema>

export const createProductSchema = z.object({
    name: z.string().trim().min(1, "Informe o nome").max(150),
    size: z.enum(PRODUCT_SIZES),
    categoryId: z.union([z.string().regex(UUID_REGEX, "Categoria inválida"), z.literal("")]).optional(),
    price: z.coerce.number().positive("Preço > 0"),
    description: z.string().max(255).optional().or(z.literal("")),
    ingredients: z
        .array(productIngredientSchema)
        .min(1, "Adicione ao menos 1 ingrediente")
        .refine(
            (arr) => new Set(arr.map((i) => i.ingredientId)).size === arr.length,
            "Ingredientes duplicados não são permitidos"
        ),
})
export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema
export type UpdateProductInput = z.infer<typeof updateProductSchema>

export type ProductFilters = {
    category?: string
    size?: ProductSize
    active?: boolean
    page?: number
    pageSize?: number
}

export function useProducts(filters: ProductFilters = {}) {
    const page = filters.page ?? 0
    const pageSize = filters.pageSize ?? 20
    const params: Record<string, string | number | boolean> = { page, pageSize }
    if (filters.category) params.category = filters.category
    if (filters.size) params.size = filters.size
    if (filters.active !== undefined) params.active = filters.active
    return useQuery({
        queryKey: [
            "products",
            {
                category: filters.category ?? null,
                size: filters.size ?? null,
                active: filters.active ?? null,
                page,
                pageSize,
            },
        ],
        queryFn: () => api.get<Page<Product>>("/products", { params }).then((r) => r.data),
    })
}

export function useProduct(id: string) {
    return useQuery({
        queryKey: ["products", id],
        queryFn: () => api.get<Product>(`/products/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export function useAllProducts() {
    return useQuery({
        queryKey: ["products", "all-active"],
        queryFn: () =>
            api
                .get<Page<Product>>("/products", { params: { page: 0, pageSize: 1000, active: true } })
                .then((r) => r.data.data),
        staleTime: 5 * 60 * 1000,
    })
}

function normalizePayload(input: CreateProductInput | UpdateProductInput) {
    return {
        ...input,
        categoryId: input.categoryId === "" ? null : input.categoryId,
        description: input.description === "" ? null : input.description,
    }
}

export function useCreateProduct() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateProductInput) =>
            api.post<Product>("/products", normalizePayload(input)).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    })
}

export function useUpdateProduct() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
            api.put<Product>(`/products/${id}`, normalizePayload(input)).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    })
}

export function useDeactivateProduct() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/products/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    })
}
