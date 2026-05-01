import { api } from "@/lib/api"
import type { Role, User } from "@/lib/auth"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export type { Role, User }

export type Page<T> = { data: T[]; page: number; size: number; total: number }

export const createUserSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(100),
    email: z.string().email("E-mail inválido").max(150),
    password: z.string().min(6, "Mínimo 6 caracteres").max(100),
    role: z.enum(["OWNER", "EMPLOYEE"]),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(150),
    role: z.enum(["OWNER", "EMPLOYEE"]),
    active: z.boolean(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Informe a senha atual"),
        newPassword: z.string().min(6, "Mínimo 6 caracteres").max(100),
        confirmPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
        path: ["confirmPassword"],
        message: "As senhas não coincidem",
    })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export function useUsers(page = 0, size = 20) {
    return useQuery({
        queryKey: ["users", page, size],
        queryFn: () =>
            api.get<Page<User>>("/users", { params: { page, size } }).then((r) => r.data),
    })
}

export function useCreateUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateUserInput) =>
            api.post<User>("/users", input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    })
}

export function useUpdateUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
            api.put<User>(`/users/${id}`, input).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    })
}

export function useDeactivateUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete(`/users/${id}`).then(() => undefined),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    })
}

export function useReactivateUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
            api.put<User>(`/users/${id}`, { ...input, active: true }).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    })
}

export function useChangeMyPassword() {
    return useMutation({
        mutationFn: (input: { currentPassword: string; newPassword: string }) =>
            api.put("/users/me/password", input).then(() => undefined),
    })
}