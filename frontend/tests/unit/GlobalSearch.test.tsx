import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GlobalSearch } from "../../src/components/GlobalSearch";

const query = vi.fn();
vi.mock("../../src/lib/api", () => ({
  searchApi: {
    query: (...args: unknown[]) => query(...args),
  },
}));

const exportData = vi.fn();
vi.mock("../../src/utils/exportUtils", () => ({
  exportData: (...args: unknown[]) => exportData(...args),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}));

const MOCK_RESULTS = [
  { id: "samples-1", type: "Sample", title: "Zebrafish Cortisol Panel", subtitle: "blood — stored", icon: "🧪", page: "samples", date: 1700000000000 },
  { id: "protocols-1", type: "Protocol", title: "Cortisol ELISA Protocol", subtitle: "v2 — active", icon: "📋", page: "protocols", date: 1700000000000 },
];

describe("GlobalSearch", () => {
  beforeEach(() => {
    query.mockReset();
    exportData.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("shows the header trigger with the ⌘K hint and no results panel until opened", () => {
    render(<GlobalSearch onNavigate={vi.fn()} />);
    expect(screen.getByText(/Search.../)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Search samples, protocols/i)).not.toBeInTheDocument();
  });

  it("opens the panel on click and queries searchApi once the term is 2+ chars", async () => {
    query.mockResolvedValue({ data: MOCK_RESULTS });
    render(<GlobalSearch onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByText(/Search.../));
    const input = screen.getByPlaceholderText(/Search samples, protocols/i);
    fireEvent.change(input, { target: { value: "cortisol" } });

    await waitFor(() => expect(query).toHaveBeenCalledWith("cortisol"));
    await waitFor(() => expect(screen.getByText("Zebrafish Cortisol Panel")).toBeInTheDocument());
    expect(screen.getByText("Cortisol ELISA Protocol")).toBeInTheDocument();
    // Grouped by type badge.
    expect(screen.getByText("Sample")).toBeInTheDocument();
    expect(screen.getByText("Protocol")).toBeInTheDocument();
  });

  it("does not query for a single-character term", async () => {
    render(<GlobalSearch onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByText(/Search.../));
    fireEvent.change(screen.getByPlaceholderText(/Search samples, protocols/i), { target: { value: "c" } });

    await new Promise((r) => setTimeout(r, 350));
    expect(query).not.toHaveBeenCalled();
  });

  it("navigates to the result's page and closes the panel when a result is clicked", async () => {
    query.mockResolvedValue({ data: MOCK_RESULTS });
    const onNavigate = vi.fn();
    render(<GlobalSearch onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText(/Search.../));
    fireEvent.change(screen.getByPlaceholderText(/Search samples, protocols/i), { target: { value: "cortisol" } });
    await waitFor(() => expect(screen.getByText("Zebrafish Cortisol Panel")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Zebrafish Cortisol Panel"));
    expect(onNavigate).toHaveBeenCalledWith("samples");
    await waitFor(() => expect(screen.queryByPlaceholderText(/Search samples, protocols/i)).not.toBeInTheDocument());
  });

  it("shows a no-results message for a term that matches nothing", async () => {
    query.mockResolvedValue({ data: [] });
    render(<GlobalSearch onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByText(/Search.../));
    fireEvent.change(screen.getByPlaceholderText(/Search samples, protocols/i), { target: { value: "xyzzy" } });
    await waitFor(() => expect(screen.getByText(/No results found for "xyzzy"/)).toBeInTheDocument());
  });

  it("downloads the current result set as Excel via exportData", async () => {
    query.mockResolvedValue({ data: MOCK_RESULTS });
    exportData.mockResolvedValue(undefined);
    render(<GlobalSearch onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByText(/Search.../));
    fireEvent.change(screen.getByPlaceholderText(/Search samples, protocols/i), { target: { value: "cortisol" } });
    await waitFor(() => expect(screen.getByText("Zebrafish Cortisol Panel")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Excel/i }));

    await waitFor(() => expect(exportData).toHaveBeenCalledTimes(1));
    const [rows, options, columns] = exportData.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Type: "Sample", Title: "Zebrafish Cortisol Panel" });
    expect(options).toMatchObject({ format: "excel", filename: "labos-search-results" });
    expect(columns).toEqual(["Type", "Title", "Details", "Date"]);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("downloads the current result set as PDF via exportData", async () => {
    query.mockResolvedValue({ data: MOCK_RESULTS });
    exportData.mockResolvedValue(undefined);
    render(<GlobalSearch onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByText(/Search.../));
    fireEvent.change(screen.getByPlaceholderText(/Search samples, protocols/i), { target: { value: "cortisol" } });
    await waitFor(() => expect(screen.getByText("Zebrafish Cortisol Panel")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /PDF/i }));

    await waitFor(() => expect(exportData).toHaveBeenCalledTimes(1));
    expect(exportData.mock.calls[0][1]).toMatchObject({ format: "pdf" });
  });
});
