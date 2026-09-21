import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StorageBreadcrumbs } from "../../src/features/storage/StorageBreadcrumbs";

describe("StorageBreadcrumbs", () => {
  it("renders every crumb in order", () => {
    render(
      <StorageBreadcrumbs
        crumbs={[{ id: null, name: "Freezer 1" }, { id: "shelf-1", name: "Shelf A" }, { id: "rack-1", name: "Rack 1" }]}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("Freezer 1")).toBeInTheDocument();
    expect(screen.getByText("Shelf A")).toBeInTheDocument();
    expect(screen.getByText("Rack 1")).toBeInTheDocument();
  });

  it("marks only the last crumb as the current location, non-clickable", () => {
    render(
      <StorageBreadcrumbs
        crumbs={[{ id: null, name: "Freezer 1" }, { id: "shelf-1", name: "Shelf A" }]}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("Shelf A")).toHaveAttribute("aria-current", "location");
    expect(screen.getByText("Shelf A").tagName).toBe("SPAN");
    expect(screen.getByRole("button", { name: "Freezer 1" })).toBeInTheDocument();
  });

  it("calls onNavigate with the crumb's id when clicked", () => {
    const onNavigate = vi.fn();
    render(
      <StorageBreadcrumbs
        crumbs={[{ id: null, name: "Freezer 1" }, { id: "shelf-1", name: "Shelf A" }, { id: "rack-1", name: "Rack 1" }]}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Shelf A" }));
    expect(onNavigate).toHaveBeenCalledWith("shelf-1");
  });

  it("navigating to the root crumb passes null", () => {
    const onNavigate = vi.fn();
    render(
      <StorageBreadcrumbs
        crumbs={[{ id: null, name: "Freezer 1" }, { id: "shelf-1", name: "Shelf A" }]}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Freezer 1" }));
    expect(onNavigate).toHaveBeenCalledWith(null);
  });
});
