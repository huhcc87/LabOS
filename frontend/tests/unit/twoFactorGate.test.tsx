import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Isolate } from "../../src/components/TwoFactorGate";

function Boom(): never { throw new Error("security:status Server Error"); }

describe("Isolate", () => {
  it("shows the app, not a blank page, when the security check throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Isolate fallback={<p>the app</p>}><Boom /></Isolate>);
    expect(screen.getByText("the app")).toBeTruthy();
    spy.mockRestore();
  });

  it("renders its children when nothing fails", () => {
    render(<Isolate fallback={<p>fallback</p>}><p>checked app</p></Isolate>);
    expect(screen.getByText("checked app")).toBeTruthy();
  });
});
