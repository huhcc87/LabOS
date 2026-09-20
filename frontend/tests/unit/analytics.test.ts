import { describe, it, expect, vi } from "vitest";
import { trackEvent, trackPageView } from "../../src/lib/analytics";

describe("analytics", () => {
  it("trackEvent logs to console in dev", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    trackEvent("test_event", { key: "value" });
    expect(spy).toHaveBeenCalledWith(
      "[Analytics]",
      "test_event",
      expect.objectContaining({ key: "value" })
    );
    spy.mockRestore();
  });

  it("trackPageView includes page name", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    trackPageView("dashboard");
    expect(spy).toHaveBeenCalledWith(
      "[Analytics]",
      "$pageview",
      expect.objectContaining({ page: "dashboard" })
    );
    spy.mockRestore();
  });
});
