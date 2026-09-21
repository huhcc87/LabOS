import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SampleActionsDialog } from "../../src/features/storage/SampleActionsDialog";

const get = vi.fn();
const move = vi.fn();
const checkout = vi.fn();
const returnSample = vi.fn();
const dispose = vi.fn();
const listBoxes = vi.fn();
const listForBox = vi.fn();

vi.mock("../../src/lib/api", () => ({
  samplesApi: {
    get: (...args: unknown[]) => get(...args),
    move: (...args: unknown[]) => move(...args),
    checkout: (...args: unknown[]) => checkout(...args),
    returnSample: (...args: unknown[]) => returnSample(...args),
    dispose: (...args: unknown[]) => dispose(...args),
  },
  storageNodesApi: { listBoxes: (...args: unknown[]) => listBoxes(...args) },
  storagePositionsApi: { listForBox: (...args: unknown[]) => listForBox(...args) },
}));

describe("SampleActionsDialog", () => {
  beforeEach(() => {
    get.mockReset(); move.mockReset(); checkout.mockReset();
    returnSample.mockReset(); dispose.mockReset(); listBoxes.mockReset(); listForBox.mockReset();
    get.mockResolvedValue({ data: { id: "s1", sample_id: "SAM-1", name: "Sample One", status: "stored" } });
  });

  it("shows Check out for a sample that isn't checked out, Return once it is", async () => {
    render(
      <SampleActionsDialog isOpen labId="lab-1" unitId="unit-1" sampleId="s1" currentLabel="A1" onClose={vi.fn()} onChanged={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Check out/ })).toBeInTheDocument());

    get.mockResolvedValueOnce({ data: { id: "s1", sample_id: "SAM-1", name: "Sample One", status: "stored", checked_out_by: "u1" } });
    checkout.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole("button", { name: /Check out/ }));
    await waitFor(() => expect(checkout).toHaveBeenCalledWith("lab-1", "s1"));
    await waitFor(() => expect(screen.getByRole("button", { name: /Return/ })).toBeInTheDocument());
  });

  it("move flow: pick a destination box, click an empty cell, confirm calls samples.move with that exact slot", async () => {
    listBoxes.mockResolvedValue({ data: [{ id: "box-2", name: "Box 2" }] });
    listForBox.mockResolvedValue({ data: { rows: 2, cols: 2, positions: [] } });
    move.mockResolvedValue({ data: {} });
    const onChanged = vi.fn();

    render(
      <SampleActionsDialog isOpen labId="lab-1" unitId="unit-1" sampleId="s1" currentLabel="A1" onClose={vi.fn()} onChanged={onChanged} />,
    );
    await waitFor(() => screen.getByRole("button", { name: /Move to another position/ }));
    fireEvent.click(screen.getByRole("button", { name: /Move to another position/ }));

    await waitFor(() => expect(listBoxes).toHaveBeenCalledWith("lab-1", "unit-1"));
    fireEvent.change(screen.getByLabelText("Destination box"), { target: { value: "box-2" } });
    await waitFor(() => expect(listForBox).toHaveBeenCalledWith("lab-1", "box-2"));

    fireEvent.click(await screen.findByLabelText("A1: Empty"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm move" }));

    await waitFor(() => expect(move).toHaveBeenCalledWith("lab-1", "s1", "box-2", 0, 0, "A1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("surfaces a move conflict as a usable error instead of closing the dialog", async () => {
    listBoxes.mockResolvedValue({ data: [{ id: "box-2", name: "Box 2" }] });
    listForBox.mockResolvedValue({ data: { rows: 1, cols: 1, positions: [] } });
    move.mockRejectedValue(new Error("Destination A1 is already occupied"));

    render(
      <SampleActionsDialog isOpen labId="lab-1" unitId="unit-1" sampleId="s1" currentLabel="A1" onClose={vi.fn()} onChanged={vi.fn()} />,
    );
    await waitFor(() => screen.getByRole("button", { name: /Move to another position/ }));
    fireEvent.click(screen.getByRole("button", { name: /Move to another position/ }));
    fireEvent.change(await screen.findByLabelText("Destination box"), { target: { value: "box-2" } });
    fireEvent.click(await screen.findByLabelText("A1: Empty"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm move" }));

    await waitFor(() => expect(move).toHaveBeenCalled());
    // Dialog stays open on failure (Confirm move button still present) rather than silently closing.
    expect(screen.getByRole("button", { name: "Confirm move" })).toBeInTheDocument();
  });

  it("dispose requires a reason before it can be confirmed", async () => {
    render(
      <SampleActionsDialog isOpen labId="lab-1" unitId="unit-1" sampleId="s1" currentLabel="A1" onClose={vi.fn()} onChanged={vi.fn()} />,
    );
    await waitFor(() => screen.getByRole("button", { name: /Dispose/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dispose/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm dispose" }));
    expect(dispose).not.toHaveBeenCalled();
  });
});
