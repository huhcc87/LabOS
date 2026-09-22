import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SampleBatchImportWizard } from "../../src/features/storage/SampleBatchImportWizard";

const listBoxes = vi.fn();
const resolveBarcode = vi.fn();
const batchValidate = vi.fn();
const batchCommit = vi.fn();

vi.mock("../../src/lib/api", () => ({
  storageNodesApi: { listBoxes: (...a: unknown[]) => listBoxes(...a) },
  samplesApi: {
    resolveBarcode: (...a: unknown[]) => resolveBarcode(...a),
    batchValidate: (...a: unknown[]) => batchValidate(...a),
    batchCommit: (...a: unknown[]) => batchCommit(...a),
  },
}));

const CSV = "BC1,Box 1,0,0,A1\nBC2,Box 1,0,1,A2";

describe("SampleBatchImportWizard", () => {
  beforeEach(() => {
    listBoxes.mockReset(); resolveBarcode.mockReset(); batchValidate.mockReset(); batchCommit.mockReset();
    listBoxes.mockResolvedValue({ data: [{ id: "box-1", name: "Box 1" }] });
  });

  it("preview resolves each row and flags an unresolvable barcode without blocking the valid rows", async () => {
    resolveBarcode.mockImplementation(async (_labId: string, code: string) =>
      code === "BC1" ? { data: { sample: { id: "s1", name: "Sample One" } } } : { data: null },
    );
    batchValidate.mockResolvedValue({ data: { valid: true, errors: [] } });

    render(<SampleBatchImportWizard isOpen labId="lab-1" unitId="unit-1" onClose={vi.fn()} onImported={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/BC2024001/), { target: { value: CSV } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(screen.getByText("Sample One")).toBeInTheDocument());
    expect(screen.getByText(/No sample for "BC2"/)).toBeInTheDocument();
    // only the one resolvable row is sent to batchValidate
    expect(batchValidate).toHaveBeenCalledWith("lab-1", [{ sampleId: "s1", boxId: "box-1", row: 0, col: 0, label: "A1" }]);
  });

  it("surfaces a backend validation error per row and blocks commit until it's clean", async () => {
    resolveBarcode.mockResolvedValue({ data: { sample: { id: "s1", name: "Sample One" } } });
    batchValidate.mockResolvedValue({ data: { valid: false, errors: [{ index: 0, message: "Position A1 is already occupied" }] } });

    render(<SampleBatchImportWizard isOpen labId="lab-1" unitId="unit-1" onClose={vi.fn()} onImported={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/BC2024001/), { target: { value: "BC1,Box 1,0,0,A1" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(screen.getByText("Position A1 is already occupied")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Import/ })).toBeDisabled();
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it("commits all valid rows in one call and reports the result", async () => {
    resolveBarcode.mockResolvedValue({ data: { sample: { id: "s1", name: "Sample One" } } });
    batchValidate.mockResolvedValue({ data: { valid: true, errors: [] } });
    batchCommit.mockResolvedValue({ data: { success: true, placed: ["p1"] } });
    const onImported = vi.fn();

    render(<SampleBatchImportWizard isOpen labId="lab-1" unitId="unit-1" onClose={vi.fn()} onImported={onImported} />);
    fireEvent.change(screen.getByPlaceholderText(/BC2024001/), { target: { value: "BC1,Box 1,0,0,A1" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Import 1 samples/ })).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: /Import 1 samples/ }));
    await waitFor(() => expect(batchCommit).toHaveBeenCalledWith("lab-1", [{ sampleId: "s1", boxId: "box-1", row: 0, col: 0, label: "A1" }]));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
  });
});
