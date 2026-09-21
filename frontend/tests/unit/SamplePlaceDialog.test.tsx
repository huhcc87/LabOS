import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SamplePlaceDialog } from "../../src/features/storage/SamplePlaceDialog";

const searchByName = vi.fn();
const place = vi.fn();
vi.mock("../../src/lib/api", () => ({
  samplesApi: {
    searchByName: (...args: unknown[]) => searchByName(...args),
    place: (...args: unknown[]) => place(...args),
    resolveBarcode: vi.fn(),
  },
}));
vi.mock("../../src/components/BarcodeScanner", () => ({
  BarcodeScanner: () => null,
}));

describe("SamplePlaceDialog", () => {
  beforeEach(() => {
    searchByName.mockReset();
    place.mockReset();
  });

  it("prefills the target label in the dialog title", () => {
    render(
      <SamplePlaceDialog isOpen labId="lab-1" boxId="box-1" row={2} col={3} label="C4" onClose={vi.fn()} onPlaced={vi.fn()} />,
    );
    expect(screen.getByText("Place sample at C4")).toBeInTheDocument();
  });

  it("searches, selects a result, and places it at the exact prefilled position", async () => {
    searchByName.mockResolvedValue({ data: [{ id: "s1", sample_id: "SAM-1", name: "Sample One" }] });
    place.mockResolvedValue({ data: {} });
    const onPlaced = vi.fn();

    render(
      <SamplePlaceDialog isOpen labId="lab-1" boxId="box-1" row={2} col={3} label="C4" onClose={vi.fn()} onPlaced={onPlaced} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Search by sample ID/i), { target: { value: "Sample One" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText("Sample One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Sample One"));
    fireEvent.click(screen.getByRole("button", { name: "Place here" }));

    await waitFor(() => expect(place).toHaveBeenCalledWith("lab-1", "s1", "box-1", 2, 3, "C4"));
    await waitFor(() => expect(onPlaced).toHaveBeenCalled());
  });

  it("disables Place here until a result is selected", async () => {
    searchByName.mockResolvedValue({ data: [{ id: "s1", sample_id: "SAM-1", name: "Sample One" }] });
    render(<SamplePlaceDialog isOpen labId="lab-1" boxId="box-1" row={0} col={0} label="A1" onClose={vi.fn()} onPlaced={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Place here" })).toBeDisabled();
  });
});
