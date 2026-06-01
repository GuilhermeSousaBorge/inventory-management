import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

export class ApiError extends Error {
  status: number;
  fieldErrors?: string[];
  constructor(status: number, message: string, fieldErrors?: string[]) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const TOKEN_KEY = "fv.access";
const REFRESH_KEY = "fv.refresh";

export const tokenStorage = {
  getAccess: () =>
    typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY),
  setAccess: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  getRefresh: () =>
    typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY),
  setRefresh: (token: string) => localStorage.setItem(REFRESH_KEY, token),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

api.interceptors.response.use((response) => {
  const body = response.data;
  if (
    body &&
    typeof body === "object" &&
    "data" in body &&
    Object.keys(body).length === 1
  ) {
    response.data = (body as { data: unknown }).data;
  }
  return response;
});

let refreshInFlight: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) throw new Error("No refresh token");
  const res = await axios.post<
    | { accessToken: string; refreshToken: string }
    | { data: { accessToken: string; refreshToken: string } }
  >(
    "/api/auth/refresh",
    { refreshToken },
    { headers: { "Content-Type": "application/json" } },
  );
  const payload =
    "data" in (res.data as object)
      ? (res.data as { data: { accessToken: string; refreshToken: string } })
          .data
      : (res.data as { accessToken: string; refreshToken: string });
  tokenStorage.setAccess(payload.accessToken);
  tokenStorage.setRefresh(payload.refreshToken);
  return payload.accessToken;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    const isAuthEndpoint =
      url.startsWith("/auth/login") || url.startsWith("/auth/refresh");

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !isAuthEndpoint &&
      tokenStorage.getRefresh()
    ) {
      try {
        if (!refreshInFlight)
          refreshInFlight = performRefresh().finally(() => {
            refreshInFlight = null;
          });
        const newToken = await refreshInFlight;
        original._retry = true;
        original.headers = {
          ...(original.headers ?? {}),
          Authorization: `Bearer ${newToken}`,
        };
        return api(original);
      } catch {
        tokenStorage.clear();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth:expired"));
        }
        return Promise.reject(toApiError(error));
      }
    }

    return Promise.reject(toApiError(error));
  },
);

function toApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const body = error.response?.data as
    | { error?: string; errors?: string[] }
    | undefined;

  if (body?.errors && Array.isArray(body.errors)) {
    return new ApiError(
      status,
      body.errors[0] ?? "Erro de validação",
      body.errors,
    );
  }
  if (body?.error) return new ApiError(status, body.error);
  if (status === 401) return new ApiError(status, "Sessão expirada");
  if (status === 0)
    return new ApiError(0, "Falha ao se conectar com o servidor");
  return new ApiError(status, error.message ?? "Erro desconhecido");
}
