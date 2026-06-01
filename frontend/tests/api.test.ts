import axios, {
  type AxiosAdapter,
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, tokenStorage } from "@/lib/api";

type MockResponse = { status: number; data?: unknown };
type Handler = (
  cfg: AxiosRequestConfig,
) => MockResponse | Promise<MockResponse>;

let handler: Handler = () => ({ status: 200, data: {} });
let calls: AxiosRequestConfig[] = [];

const adapter: AxiosAdapter = async (config) => {
  calls.push(config);
  const r = await Promise.resolve(handler(config));
  const response: AxiosResponse = {
    data: r.data,
    status: r.status,
    statusText: r.status >= 200 && r.status < 300 ? "OK" : "Error",
    headers: {},
    config,
  };
  if (r.status >= 200 && r.status < 300) return response;
  throw new AxiosError(
    `Request failed with status ${r.status}`,
    String(r.status),
    config,
    null,
    response,
  );
};

beforeEach(() => {
  handler = () => ({ status: 200, data: {} });
  calls = [];
  api.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  localStorage.clear();
});

describe("ApiError", () => {
  it("captures status, message and fieldErrors", () => {
    const err = new ApiError(400, "msg", ["a", "b"]);
    expect(err.status).toBe(400);
    expect(err.message).toBe("msg");
    expect(err.fieldErrors).toEqual(["a", "b"]);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("tokenStorage", () => {
  it("roundtrips access and refresh tokens", () => {
    tokenStorage.setAccess("a1");
    tokenStorage.setRefresh("r1");
    expect(tokenStorage.getAccess()).toBe("a1");
    expect(tokenStorage.getRefresh()).toBe("r1");
  });

  it("clear removes both", () => {
    tokenStorage.setAccess("a1");
    tokenStorage.setRefresh("r1");
    tokenStorage.clear();
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});

describe("api response interceptor — envelope unwrap", () => {
  it("unwraps single-resource { data } envelope", async () => {
    handler = () => ({
      status: 200,
      data: { data: { id: "u1", name: "Ana" } },
    });
    const res = await api.get("/users/me");
    expect(res.data).toEqual({ id: "u1", name: "Ana" });
  });

  it("keeps paginated { data, page, size, total } envelope intact", async () => {
    const paginated = { data: [{ id: "u1" }], page: 0, size: 20, total: 1 };
    handler = () => ({ status: 200, data: paginated });
    const res = await api.get("/users");
    expect(res.data).toEqual(paginated);
  });
});

describe("api request interceptor — auth header", () => {
  it("adds Authorization when access token is present", async () => {
    tokenStorage.setAccess("token-xyz");
    await api.get("/users/me");
    expect(calls[0].headers?.Authorization).toBe("Bearer token-xyz");
  });

  it("omits Authorization when no token", async () => {
    await api.get("/auth/login");
    expect(calls[0].headers?.Authorization).toBeUndefined();
  });
});

describe("api error normalization", () => {
  it("400 with errors array → ApiError with fieldErrors", async () => {
    handler = () => ({
      status: 400,
      data: { errors: ["nome obrigatório", "email inválido"] },
    });
    await expect(api.post("/users", {})).rejects.toMatchObject({
      status: 400,
      message: "nome obrigatório",
      fieldErrors: ["nome obrigatório", "email inválido"],
    });
  });

  it("400 with error string → ApiError with that message", async () => {
    handler = () => ({ status: 400, data: { error: "E-mail já cadastrado" } });
    await expect(api.post("/users", {})).rejects.toMatchObject({
      status: 400,
      message: "E-mail já cadastrado",
    });
  });

  it("404 with error string → ApiError", async () => {
    handler = () => ({ status: 404, data: { error: "User not found" } });
    await expect(api.get("/users/zzz")).rejects.toMatchObject({
      status: 404,
      message: "User not found",
    });
  });

  it("401 without body and without refresh token → 'Sessão expirada'", async () => {
    handler = () => ({ status: 401, data: undefined });
    await expect(api.get("/units")).rejects.toMatchObject({
      status: 401,
      message: "Sessão expirada",
    });
  });

  it("401 on /auth/login skips refresh and surfaces ApiError", async () => {
    tokenStorage.setRefresh("r1");
    handler = () => ({ status: 401, data: undefined });
    await expect(
      api.post("/auth/login", { email: "a", password: "b" }),
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(calls.filter((c) => c.url?.includes("/auth/refresh"))).toHaveLength(
      0,
    );
  });
});

describe("api refresh-on-401", () => {
  it("refreshes once for parallel 401s (single-flight) and retries originals", async () => {
    tokenStorage.setAccess("expired");
    tokenStorage.setRefresh("r1");

    const responses = new Map<string, MockResponse[]>([
      [
        "/units",
        [
          { status: 401 },
          { status: 200, data: { data: [], page: 0, size: 20, total: 0 } },
        ],
      ],
      [
        "/users/me",
        [{ status: 401 }, { status: 200, data: { data: { id: "u1" } } }],
      ],
      [
        "/auth/refresh",
        [
          {
            status: 200,
            data: {
              data: { accessToken: "new-access", refreshToken: "new-refresh" },
            },
          },
        ],
      ],
    ]);

    handler = (cfg) => {
      const url = cfg.url ?? "";
      const key = url.replace("/api", "");
      const queue = responses.get(key) ?? [];
      return queue.shift() ?? { status: 500 };
    };

    const [unitsRes, meRes] = await Promise.all([
      api.get("/units"),
      api.get("/users/me"),
    ]);

    expect(unitsRes.data).toEqual({ data: [], page: 0, size: 20, total: 0 });
    expect(meRes.data).toEqual({ id: "u1" });

    const refreshCalls = calls.filter((c) =>
      (c.url ?? "").includes("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(tokenStorage.getAccess()).toBe("new-access");
    expect(tokenStorage.getRefresh()).toBe("new-refresh");
  });

  it("on refresh failure: clears tokens and dispatches 'auth:expired'", async () => {
    tokenStorage.setAccess("expired");
    tokenStorage.setRefresh("r1");

    const eventSpy = vi.fn();
    window.addEventListener("auth:expired", eventSpy);

    const responses = new Map<string, MockResponse[]>([
      ["/units", [{ status: 401 }]],
      ["/auth/refresh", [{ status: 401 }]],
    ]);

    handler = (cfg) => {
      const key = (cfg.url ?? "").replace("/api", "");
      return responses.get(key)?.shift() ?? { status: 500 };
    };

    await expect(api.get("/units")).rejects.toBeInstanceOf(ApiError);

    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
    expect(eventSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener("auth:expired", eventSpy);
  });
});
