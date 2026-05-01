"use client"

import { ApiError, api, tokenStorage } from "@/lib/api"
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

export type Role = "OWNER" | "EMPLOYEE"

export type User = {
    id: string
    name: string
    email: string
    role: Role
    active: boolean
    createdAt: string
}

type AuthState = {
    user: User | null
    status: "loading" | "authenticated" | "unauthenticated"
}

type AuthContextValue = AuthState & {
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        status: tokenStorage.getAccess() ? "loading" : "unauthenticated",
    })

    const refreshUser = useCallback(async () => {
        try {
            const user = await api.get<User>("/users/me").then((r) => r.data)
            setState({ user, status: "authenticated" })
        } catch {
            tokenStorage.clear()
            setState({ user: null, status: "unauthenticated" })
        }
    }, [])

    useEffect(() => {
        if (state.status === "loading") void refreshUser()
    }, [state.status, refreshUser])

    useEffect(() => {
        const onExpired = () => setState({ user: null, status: "unauthenticated" })
        window.addEventListener("auth:expired", onExpired)
        return () => window.removeEventListener("auth:expired", onExpired)
    }, [])

    const login = useCallback(async (email: string, password: string) => {
        const tokens = await api
            .post<{ accessToken: string; refreshToken: string }>("/auth/login", { email, password })
            .then((r) => r.data)
        tokenStorage.setAccess(tokens.accessToken)
        tokenStorage.setRefresh(tokens.refreshToken)
        await refreshUser()
    }, [refreshUser])

    const logout = useCallback(async () => {
        const refreshToken = tokenStorage.getRefresh()
        if (refreshToken) {
            try {
                await api.post("/auth/logout", { refreshToken })
            } catch {
                // ignore — clear local anyway
            }
        }
        tokenStorage.clear()
        setState({ user: null, status: "unauthenticated" })
    }, [])

    return (
        <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used within AuthProvider")
    return ctx
}

export function isApiError(e: unknown): e is ApiError {
    return e instanceof ApiError
}