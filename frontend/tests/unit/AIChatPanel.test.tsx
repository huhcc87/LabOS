import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AIChatPanel } from "../../src/components/AIChatPanel";
import { aiApi } from "../../src/lib/api";

vi.mock("../../src/lib/api", () => ({
  aiApi: {
    chat: vi.fn(),
    confirmAction: vi.fn(),
  },
}));

function askAndWaitForCard(input: HTMLElement, question: string) {
  fireEvent.change(input, { target: { value: question } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("AIChatPanel — proposed-action confirm gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never calls confirmAction just from rendering a destructive proposal — only after Confirm is clicked", async () => {
    (aiApi.chat as any).mockResolvedValue({
      data: {
        answer: "I've drafted a proposal to dispose SAM-042. Please confirm.",
        suggestions: [],
        source: "anthropic",
        proposedActions: [
          {
            id: "dispose_sample:abc:1",
            actionType: "dispose_sample",
            summary: 'Dispose sample SAM-042 ("Mouse liver biopsy")? This cannot be undone.',
            destructive: true,
            payload: { sample_id: "abc", reason: "contaminated" },
          },
        ],
        searchResults: [],
      },
    });
    (aiApi.confirmAction as any).mockResolvedValue({ data: { id: "abc" } });

    render(<AIChatPanel onClose={() => {}} />);
    const input = screen.getByPlaceholderText("Ask about your lab...");
    askAndWaitForCard(input, "dispose sample SAM-042, contaminated");

    await screen.findByText(/Dispose sample SAM-042/);

    // Rendering the card must not itself run the mutation.
    expect(aiApi.confirmAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(aiApi.confirmAction).toHaveBeenCalledWith("dispose_sample", { sample_id: "abc", reason: "contaminated" })
    );
    await screen.findByText("✓ Done");
  });

  it("clicking Cancel on a proposal never calls confirmAction", async () => {
    (aiApi.chat as any).mockResolvedValue({
      data: {
        answer: "Draft ready.",
        suggestions: [],
        source: "anthropic",
        proposedActions: [
          {
            id: "archive_storage_unit:xyz:1",
            actionType: "archive_storage_unit",
            summary: 'Archive storage unit "Old Freezer"?',
            destructive: true,
            payload: { id: "xyz" },
          },
        ],
        searchResults: [],
      },
    });

    render(<AIChatPanel onClose={() => {}} />);
    const input = screen.getByPlaceholderText("Ask about your lab...");
    askAndWaitForCard(input, "archive the old freezer");

    await screen.findByText(/Archive storage unit/);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await screen.findByText("Cancelled");
    expect(aiApi.confirmAction).not.toHaveBeenCalled();
  });

  it("renders inline search results distinct from proposed-action cards", async () => {
    (aiApi.chat as any).mockResolvedValue({
      data: {
        answer: "Here's what I found.",
        suggestions: [],
        source: "anthropic",
        proposedActions: [],
        searchResults: [
          { id: "smp-1", type: "Sample", title: "Zebrafish Fin Clip", subtitle: "tissue — stored", icon: "🧪", page: "samples" },
        ],
      },
    });

    render(<AIChatPanel onClose={() => {}} />);
    const input = screen.getByPlaceholderText("Ask about your lab...");
    askAndWaitForCard(input, "find zebrafish");

    await screen.findByText("Zebrafish Fin Clip");
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });
});
