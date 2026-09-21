import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCurrentLab } from "../../src/features/storage/useCurrentLab";

const listMy = vi.fn();
vi.mock("../../src/lib/api", () => ({
  labMembersApi: { listMy: (...args: unknown[]) => listMy(...args) },
}));

describe("useCurrentLab", () => {
  beforeEach(() => {
    listMy.mockReset();
    localStorage.clear();
  });

  it("defaults to the first active lab when none was previously selected", async () => {
    listMy.mockResolvedValue({
      data: [
        { id: "m1", lab_id: "lab-1", lab_role: "member", status: "active" },
        { id: "m2", lab_id: "lab-2", lab_role: "member", status: "active" },
      ],
    });
    const { result } = renderHook(() => useCurrentLab());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.labId).toBe("lab-1");
    expect(result.current.memberships).toHaveLength(2);
  });

  it("filters out non-active memberships", async () => {
    listMy.mockResolvedValue({
      data: [
        { id: "m1", lab_id: "lab-1", lab_role: "member", status: "pending" },
        { id: "m2", lab_id: "lab-2", lab_role: "member", status: "active" },
      ],
    });
    const { result } = renderHook(() => useCurrentLab());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.memberships).toHaveLength(1);
    expect(result.current.labId).toBe("lab-2");
  });

  it("shows an empty membership list, not an error, when the user has no labs", async () => {
    listMy.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useCurrentLab());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.memberships).toHaveLength(0);
    expect(result.current.labId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("surfaces a load failure as an error", async () => {
    listMy.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useCurrentLab());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network down");
  });
});
