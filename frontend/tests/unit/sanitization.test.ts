import { describe, it, expect } from "vitest";
import DOMPurify from "dompurify";

/**
 * Tests for XSS prevention via DOMPurify sanitization.
 * These patterns are used in AIChatPanel and LabNotebookPage.
 */

describe("DOMPurify sanitization", () => {
  it("strips script tags", () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script>';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("<p>Hello</p>");
  });

  it("strips event handlers", () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("onerror");
  });

  it("strips javascript: protocol links", () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("javascript:");
  });

  it("preserves safe HTML", () => {
    const safe = "<p>Normal <strong>text</strong> with <em>formatting</em></p>";
    const clean = DOMPurify.sanitize(safe);
    expect(clean).toBe(safe);
  });

  it("strips data: URI in img src", () => {
    const dirty = '<img src="data:text/html,<script>alert(1)</script>">';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("<script>");
  });

  it("strips iframe injection", () => {
    const dirty = '<iframe src="https://evil.com"></iframe>';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("<iframe");
  });

  it("handles nested injection attempts", () => {
    const dirty = '<div><p>Text<script>document.cookie</script></p></div>';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("Text");
  });

  it("strips SVG-based XSS", () => {
    const dirty = '<svg onload="alert(1)"><circle r="50"/></svg>';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("onload");
  });
});
