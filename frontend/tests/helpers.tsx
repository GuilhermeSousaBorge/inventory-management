import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import axios, { AxiosError, type AxiosAdapter, type AxiosRequestConfig, type AxiosResponse } from "axios"
import type { ReactElement, ReactNode } from "react"

import { api } from "@/lib/api"
import { AuthProvider } from "@/lib/auth"

export type MockResponse = { status: number; data?: unknown }
export type MockHandler = (cfg: AxiosRequestConfig) => MockResponse | Promise<MockResponse>

let currentHandler: MockHandler = () => ({ status: 200, data: {} })
let currentCalls: AxiosRequestConfig[] = []

const adapter: AxiosAdapter = async (config) => {
    currentCalls.push(config)
    const r = await Promise.resolve(currentHandler(config))
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

export function setHandler(h: MockHandler) {
    currentHandler = h
}

export function getCalls() {
    return currentCalls
}

export function resetMockApi() {
    currentHandler = () => ({ status: 200, data: {} })
    currentCalls = []
    api.defaults.adapter = adapter
    axios.defaults.adapter = adapter
    localStorage.clear()
}

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
}

function Providers({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={makeQueryClient()}>
            <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
    )
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
    return render(ui, { wrapper: Providers, ...options })
}
