import { describe, it, expect } from "vitest";
import { detectSearchKind } from "../../src/features/research/searchKind";

describe("detectSearchKind", () => {
  it("treats plain words as a topic", () => {
    expect(detectSearchKind("CAR-T therapy in glioblastoma")).toBe("topic");
    expect(detectSearchKind("")).toBe("topic");
  });

  it("recognises PubMed IDs, with or without labels and separators", () => {
    expect(detectSearchKind("38234567")).toBe("pmid");
    expect(detectSearchKind("38234567, 38123456")).toBe("pmid");
    expect(detectSearchKind("PMID: 38234567\n38123456")).toBe("pmid");
  });

  it("recognises DOIs", () => {
    expect(detectSearchKind("10.1038/s41586-020-2649-2")).toBe("doi");
    expect(detectSearchKind("doi:10.1016/j.cell.2020.01.001 10.1056/NEJMoa2034577")).toBe("doi");
  });

  it("does not mistake a topic that contains numbers for IDs", () => {
    expect(detectSearchKind("COVID-19 2021 outcomes")).toBe("topic");
    expect(detectSearchKind("38234567 glioma")).toBe("topic");
  });

  it("leaves pasted links to the link parser", () => {
    expect(detectSearchKind("https://pubmed.ncbi.nlm.nih.gov/?term=glioma")).toBe("topic");
  });
});
