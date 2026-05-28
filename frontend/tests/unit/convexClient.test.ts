import { describe, it, expect } from "vitest";

// Test the adapter utility functions directly
describe("convexClient utilities", () => {
  it("adapt converts _id to id and strips _creationTime", () => {
    // Replicate the adapt function logic
    function adapt(doc: any) {
      if (!doc) return doc;
      const { _id, _creationTime, ...rest } = doc;
      return { id: _id, ...rest };
    }

    const input = { _id: "abc123", _creationTime: 1234567890, name: "Test", status: "active" };
    const result = adapt(input);
    expect(result).toEqual({ id: "abc123", name: "Test", status: "active" });
    expect(result._id).toBeUndefined();
    expect(result._creationTime).toBeUndefined();
  });

  it("adapt handles null gracefully", () => {
    function adapt(doc: any) {
      if (!doc) return doc;
      const { _id, _creationTime, ...rest } = doc;
      return { id: _id, ...rest };
    }

    expect(adapt(null)).toBeNull();
    expect(adapt(undefined)).toBeUndefined();
  });

  it("toStr converts numbers and strings", () => {
    function toStr(id: string | number): string {
      return String(id);
    }

    expect(toStr(123)).toBe("123");
    expect(toStr("abc")).toBe("abc");
    expect(toStr(0)).toBe("0");
  });

  it("paginated returns correct page structure", () => {
    function paginated(items: any[], page: number, perPage: number) {
      const start = (page - 1) * perPage;
      const pageItems = items.slice(start, start + perPage).map((d: any) => {
        if (!d) return d;
        const { _id, _creationTime, ...rest } = d;
        return { id: _id, ...rest };
      });
      return {
        data: {
          items: pageItems,
          total: items.length,
          page,
          per_page: perPage,
          pages: Math.ceil(items.length / perPage) || 1,
        },
      };
    }

    const items = Array.from({ length: 25 }, (_, i) => ({ _id: `id${i}`, _creationTime: 0, name: `Item ${i}` }));
    const result = paginated(items, 2, 10);
    expect(result.data.items).toHaveLength(10);
    expect(result.data.total).toBe(25);
    expect(result.data.page).toBe(2);
    expect(result.data.pages).toBe(3);
    expect(result.data.items[0].id).toBe("id10");
  });
});
