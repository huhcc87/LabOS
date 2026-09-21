import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OccupancySummary } from "../../src/features/storage/OccupancySummary";

describe("OccupancySummary", () => {
  it("shows used/capacity and the breakdown per state", () => {
    render(<OccupancySummary stats={{ capacity: 81, occupied: 40, reserved: 5, quarantined: 2, unavailable: 1 }} />);
    expect(screen.getByText("48 / 81 positions used")).toBeInTheDocument();
    expect(screen.getByText("● 40 occupied")).toBeInTheDocument();
    expect(screen.getByText("◐ 5 reserved")).toBeInTheDocument();
    expect(screen.getByText("▲ 2 quarantined")).toBeInTheDocument();
    expect(screen.getByText("✕ 1 unavailable")).toBeInTheDocument();
  });

  it("shows 0% for an empty box, without dividing by zero", () => {
    render(<OccupancySummary stats={{ capacity: 0, occupied: 0, reserved: 0, quarantined: 0, unavailable: 0 }} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
