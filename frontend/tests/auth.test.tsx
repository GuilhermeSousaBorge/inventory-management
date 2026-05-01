import { act, render, screen, waitFor } from "@testing-library/react"
import axios, { AxiosError, type AxiosAdapter, type AxiosRequestConfig, type AxiosResponse } from "axios"
import { beforeEach, describe, expect, it } from "vitest"

import { ApiError, api, tokenStorage } from "@/lib/api"
import { AuthProvider, useAuth } from "@/lib/auth"

type MockResponse = { status: number; data?: unknown }
type Handler = (cfg: AxiosRequestConfig) => MockResponse | Promise<MockResponse>

let handler: Handler = () => ({ status: 200, data: {} })
let calls: AxiosRequestConfig[] = []

const adapter: AxiosAdapter = async (config) => {
    calls.push(config)
    const r = await Promise.resolve(handler(config))
    const response: AxiosResponse = {
        data: r.data,
        status: r.status,
        statusText: r.status >= 200 && r.status < 300 ? "OK" : "Error",
        headers: {},
        config,
    }
    if (r.status >= 200 && r.status < 300) return response
    throw new AxiosError(`Request failed with status ${r.status}`, String(r.status), config, null, response)
}

beforeEach(() => {
    handler = () => ({ status: 200, data: {} })
    calls = []
    api.defaults.adapter = adapter
    axios.defaults.adapter = adapter
    localStorage.clear()
})

type Captured = ReturnType<typeof useAuth>

function Probe({ onChange }: { onChange: (v: Captured) => void }) {
    const auth = useAuth()
    onChange(auth)
    return (
        <>
            <div data-testid="status">{auth.status}</div>
            <div data-testid="user">{auth.user ? auth.user.email : "none"}</div>
        </>
    )
}

function renderProvider() {
    const captured: { current: Captured | null } = { current: null }
    render(
        <AuthProvider>
            <Probe onChange={(v) => (captured.current = v)} />
        </AuthProvider>,
    )
    return captured
}

describe("AuthProvider bootstrap", () => {
    it("starts unauthenticated when no access token", async () => {
        renderProvider()
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"))
        expect(screen.getByTestId("user").textContent).toBe("none")
    })

    it("with token: hydrates user from /users/me and becomes authenticated", async () => {
        tokenStorage.setAccess("a1")
        handler = () => ({
            status: 200,
            data: { data: { id: "u1", name: "Ana", email: "ana@x.com", role: "OWNER", active: true, createdAt: "2026-01-01T00:00:00Z" } },
        })
        renderProvider()
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"))
        expect(screen.getByTestId("user").textContent).toBe("ana@x.com")
    })

    it("with token but /users/me 401 and no refresh token: clears state and becomes unauthenticated", async () => {
        tokenStorage.setAccess("expired")
        handler = () => ({ status: 401, data: undefined })
        renderProvider()
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"))
        expect(tokenStorage.getAccess()).toBeNull()
    })
})

describe("AuthProvider login", () => {
    it("login success: stores tokens, hydrates user, becomes authenticated", async () => {
        const captured = renderProvider()
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"))

        handler = (cfg) => {
            if ((cfg.url ?? "").endsWith("/auth/login")) {
                return {
                    status: 200,
                    data: { data: { accessToken: "a1", refreshToken: "r1" } },
                }
            }
            if ((cfg.url ?? "").endsWith("/users/me")) {
                return {
                    status: 200,
                    data: { data: { id: "u1", name: "Ana", email: "ana@x.com", role: "OWNER", active: true, createdAt: "2026-01-01T00:00:00Z" } },
                }
            }
            return { status: 500 }
        }

        await act(async () => {
            await captured.current!.login("ana@x.com", "secret")
        })

        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"))
        expect(tokenStorage.getAccess()).toBe("a1")
        expect(tokenStorage.getRefresh()).toBe("r1")
    })

    it("login failure (401): rejects with ApiError, status remains unauthenticated", async () => {
        const captured = renderProvider()
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"))

        handler = () => ({ status: 401, data: undefined })

        await expect(
            act(async () => {
                await captured.current!.login("ana@x.com", "wrong")
            }),
        ).rejects.toBeInstanceOf(ApiError)

        expect(screen.getByTestId("status").textContent).toBe("unauthenticated")
        expect(tokenStorage.getAccess()).toBeNull()
    })
})

describe("AuthProvider logout", () => {
    it("clears tokens, calls /auth/logout, becomes unauthenticated", async () => {
        tokenStorage.setAccess("a1")
        tokenStorage.setRefresh("r1")
        handler = (cfg) => {
            if ((cfg.url ?? "").endsWith("/users/me")) {
                return {
                    status: 200,
                    data: { data: { id: "u1", name: "Ana", email: "ana@x.com", role: "OWNER", active: true, createdAt: "2026-01-01T00:00:00Z" } },
                }
            }
            if ((cfg.url ?? "").endsWith("/auth/logout")) {
                return { status: 204 }
            }
            return { status: 500 }
        }

        const captured = renderProvider()
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"))

        await act(async () => {
            await captured.current!.logout()
        })

        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"))
        expect(tokenStorage.getAccess()).toBeNull()
        expect(tokenStorage.getRefresh()).toBeNull()

        const logoutCalls = calls.filter((c) => (c.url ?? "").endsWith("/auth/logout"))
        expect(logoutCalls).toHaveLength(1)
    })

    it("clears local state even if /auth/logout fails", async () => {
        tokenStorage.setAccess("a1")
        tokenStorage.setRefresh("r1")
        handler = (cfg) => {
            if ((cfg.url ?? "").endsWith("/users/me")) {
                return {
                    status: 200,
                    data: { data: { id: "u1", name: "Ana", email: "ana@x.com", role: "OWNER", active: true, createdAt: "2026-01-01T00:00:00Z" } },
                }
            }
            if ((cfg.url ?? "").endsWith("/auth/logout")) {
                return { status: 500, data: { error: "boom" } }
            }
            return { status: 500 }
        }

        const captured = renderProvider()
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"))

        await act(async () => {
            await captured.current!.logout()
        })

        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"))
        expect(tokenStorage.getAccess()).toBeNull()
    })
})

describe("AuthProvider auth:expired event", () => {
    it("transitions to unauthenticated when auth:expired fires", async () => {
        tokenStorage.setAccess("a1")
        handler = () => ({
            status: 200,
            data: { data: { id: "u1", name: "Ana", email: "ana@x.com", role: "OWNER", active: true, createdAt: "2026-01-01T00:00:00Z" } },
        })
        renderProvider()
        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"))

        await act(async () => {
            window.dispatchEvent(new Event("auth:expired"))
        })

        await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"))
    })
})
