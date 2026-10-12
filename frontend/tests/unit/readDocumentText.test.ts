import { describe, expect, it } from "vitest";
import {
  isSupportedDocument,
  readDocumentText,
  UnsupportedDocumentError,
} from "../../src/lib/readDocumentText";

describe("readDocumentText", () => {
  it("accepts PDF, TXT and MD regardless of case", () => {
    expect(isSupportedDocument("paper.PDF")).toBe(true);
    expect(isSupportedDocument("notes.txt")).toBe(true);
    expect(isSupportedDocument("README.md")).toBe(true);
    expect(isSupportedDocument("draft.docx")).toBe(false);
    expect(isSupportedDocument("noextension")).toBe(false);
  });

  it("reads plain text and reports truncation", async () => {
    const file = new File(["a".repeat(50)], "abstract.txt", { type: "text/plain" });
    const doc = await readDocumentText(file, 20);
    expect(doc.text).toHaveLength(20);
    expect(doc.truncated).toBe(true);
    expect(doc.pages).toBe(0);
  });

  it("rejects binary formats instead of reading raw bytes", async () => {
    const file = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], "old.doc");
    await expect(readDocumentText(file, 100)).rejects.toBeInstanceOf(UnsupportedDocumentError);
  });
});
