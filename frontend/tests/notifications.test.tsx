import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  useActiveNotificationsBell,
  useNotification,
  useNotifications,
  useResolveNotification,
} from "@/lib/notifications";

import { createWrapper, getCalls, resetMockApi, setHandler } from "./helpers";

let wrapper: ReturnType<typeof createWrapper>;

beforeEach(() => {
  resetMockApi();
  wrapper = createWrapper();
});
afterEach(() => resetMockApi());

describe("useNotifications", () => {
  it("sends status, unit, from, to, page, size when present", async () => {
    setHandler(() => ({
      status: 200,
      data: { data: [], page: 0, size: 20, total: 0 },
    }));
    const { result } = renderHook(
      () =>
        useNotifications({
          status: "ACTIVE",
          unit: "u-1",
          from: "2026-05-01",
          to: "2026-05-07",
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const params = getCalls()[0]?.params as Record<string, unknown>;
    expect(params.status).toBe("ACTIVE");
    expect(params.unit).toBe("u-1");
    expect(params.from).toBe("2026-05-01");
    expect(params.to).toBe("2026-05-07");
    expect(params.page).toBe(0);
    expect(params.size).toBe(20);
  });

  it("omits filters that are absent", async () => {
    setHandler(() => ({
      status: 200,
      data: { data: [], page: 0, size: 20, total: 0 },
    }));
    renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(getCalls().length).toBeGreaterThan(0));
    const params = getCalls()[0]?.params as Record<string, unknown>;
    expect(params.status).toBeUndefined();
    expect(params.unit).toBeUndefined();
  });
});

describe("useNotification", () => {
  it("fetches single by id and unwraps envelope", async () => {
    setHandler(() => ({
      status: 200,
      data: { data: { id: "n-1", type: "LOW_STOCK" } },
    }));
    const { result } = renderHook(() => useNotification("n-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data as { id: string }).id).toBe("n-1");
    expect(getCalls()[0]?.url).toBe("/notifications/n-1");
  });
});

describe("useResolveNotification", () => {
  it("posts to /notifications/{id}/resolve and invalidates", async () => {
    setHandler(() => ({ status: 200, data: { data: { id: "n-1" } } }));
    const { result } = renderHook(() => useResolveNotification(), { wrapper });
    await result.current.mutateAsync("n-1");
    const call = getCalls()[0];
    expect(call?.method).toBe("post");
    expect(call?.url).toBe("/notifications/n-1/resolve");
  });
});

describe("useActiveNotificationsBell", () => {
  it("fetches with status=ACTIVE and size=5; exposes total", async () => {
    setHandler(() => ({
      status: 200,
      data: {
        data: [{ id: "n-1" }],
        page: 0,
        size: 5,
        total: 7,
      },
    }));
    const { result } = renderHook(() => useActiveNotificationsBell(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.total).toBe(7));
    const params = getCalls()[0]?.params as Record<string, unknown>;
    expect(params.status).toBe("ACTIVE");
    expect(params.size).toBe(5);
    expect(result.current.items).toHaveLength(1);
  });
});
