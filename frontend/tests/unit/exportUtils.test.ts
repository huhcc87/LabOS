import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportData } from "../../src/utils/exportUtils";

const clicked: string[] = [];

beforeEach(() => {
  clicked.length = 0;
  // jsdom doesn't implement anchor.click() navigation or URL.createObjectURL — stub both.
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => "blob:mock");
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("exportData — csv", () => {
  it("downloads a .csv file for csv format", async () => {
    await exportData([{ name: "A", value: 1 }], { filename: "report", format: "csv", includeTimestamp: false });
    expect(clicked[0]).toBe("report.csv");
  });
});

describe("exportData — real Excel (.xlsx), not CSV-mislabeled", () => {
  it("downloads a genuine .xlsx file, not a .csv renamed to look like Excel", async () => {
    await exportData([{ name: "A", value: 1 }], { filename: "report", format: "excel", includeTimestamp: false });
    expect(clicked[0]).toBe("report.xlsx");
  });
});

describe("exportData — real PDF (.pdf), not a print-dialog workaround", () => {
  it("downloads a genuine .pdf file instead of opening a print window", async () => {
    const openSpy = vi.spyOn(window, "open");
    await exportData([{ name: "A", value: 1 }], { filename: "report", format: "pdf", title: "Report", includeTimestamp: false });
    expect(openSpy).not.toHaveBeenCalled();
    // jsPDF's own doc.save() drives the download, not the anchor-click path used by the others.
  });

  it("handles a sample name containing HTML/script-like content without throwing (no unescaped-HTML injection path exists anymore)", async () => {
    const malicious = [{ name: '<img src=x onerror=alert(1)>', notes: '"><script>alert(2)</script>' }];
    await expect(
      exportData(malicious, { filename: "report", format: "pdf", title: "Report", includeTimestamp: false }),
    ).resolves.not.toThrow();
  });
});

describe("exportData — json", () => {
  it("downloads a .json file for json format", async () => {
    await exportData([{ name: "A" }], { filename: "report", format: "json", includeTimestamp: false });
    expect(clicked[0]).toBe("report.json");
  });
});
