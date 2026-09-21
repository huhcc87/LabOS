import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PositionGrid } from "../../src/features/storage/PositionGrid";

describe("PositionGrid", () => {
  it("renders every declared cell, empty ones included", () => {
    render(<PositionGrid rows={2} cols={2} positions={[]} />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(4);
  });

  it("announces each of the five states in text, not colour alone", () => {
    render(
      <PositionGrid
        rows={2}
        cols={3}
        positions={[
          { row: 0, col: 0, label: "A1", state: "occupied", sample_id: "s1" },
          { row: 0, col: 1, label: "A2", state: "reserved" },
          { row: 0, col: 2, label: "A3", state: "quarantined" },
          { row: 1, col: 0, label: "B1", state: "unavailable" },
        ]}
      />,
    );
    expect(screen.getByLabelText("A1: Occupied")).toBeInTheDocument();
    expect(screen.getByLabelText("A2: Reserved")).toBeInTheDocument();
    expect(screen.getByLabelText("A3: Quarantined")).toBeInTheDocument();
    expect(screen.getByLabelText("B1: Unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("B2: Empty")).toBeInTheDocument(); // row 1, col 1 — untouched
  });

  it("fires onCellClick with the clicked cell's data", () => {
    const onCellClick = vi.fn();
    render(
      <PositionGrid
        rows={1}
        cols={1}
        positions={[{ row: 0, col: 0, label: "A1", state: "occupied", sample_id: "s1" }]}
        onCellClick={onCellClick}
      />,
    );
    fireEvent.click(screen.getByLabelText("A1: Occupied"));
    expect(onCellClick).toHaveBeenCalledWith({ row: 0, col: 0, label: "A1", state: "occupied", sample_id: "s1" });
  });

  it("supports arrow-key traversal between cells", () => {
    render(<PositionGrid rows={2} cols={2} positions={[]} />);
    const first = screen.getByLabelText("A1: Empty");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByLabelText("A2: Empty")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("A2: Empty"), { key: "ArrowDown" });
    expect(screen.getByLabelText("B2: Empty")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("B2: Empty"), { key: "ArrowLeft" });
    expect(screen.getByLabelText("B1: Empty")).toHaveFocus();
  });

  it("does not move focus past the edge of the grid", () => {
    render(<PositionGrid rows={1} cols={1} positions={[]} />);
    const only = screen.getByLabelText("A1: Empty");
    only.focus();
    fireEvent.keyDown(only, { key: "ArrowRight" });
    fireEvent.keyDown(only, { key: "ArrowDown" });
    expect(only).toHaveFocus();
  });
});
