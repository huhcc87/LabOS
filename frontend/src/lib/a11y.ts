/**
 * Accessibility utilities for WCAG 2.1 AA compliance.
 */

// Skip-to-content link handler
export function setupSkipToContent() {
  const main = document.querySelector("main") ?? document.getElementById("main-content");
  if (!main) return;

  const existing = document.getElementById("skip-to-content");
  if (existing) return;

  const skip = document.createElement("a");
  skip.id = "skip-to-content";
  skip.href = "#main-content";
  skip.textContent = "Skip to main content";
  skip.className =
    "sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:text-indigo-700 focus:underline";
  skip.addEventListener("click", (e) => {
    e.preventDefault();
    main.setAttribute("tabindex", "-1");
    main.focus();
    main.removeAttribute("tabindex");
  });
  document.body.prepend(skip);
}

// Announce messages to screen readers
export function announce(message: string, priority: "polite" | "assertive" = "polite") {
  let region = document.getElementById(`a11y-${priority}`);
  if (!region) {
    region = document.createElement("div");
    region.id = `a11y-${priority}`;
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", priority);
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.appendChild(region);
  }
  region.textContent = "";
  requestAnimationFrame(() => {
    region!.textContent = message;
  });
}

// Focus trap for modals/dialogs
export function trapFocus(container: HTMLElement) {
  const focusable = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handler(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  container.addEventListener("keydown", handler);
  first?.focus();

  return () => container.removeEventListener("keydown", handler);
}

// Reduced motion preference
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Color contrast checker (WCAG AA = 4.5:1 for normal text)
export function meetsContrastRatio(fg: string, bg: string, ratio = 4.5): boolean {
  const luminance = (hex: string) => {
    const rgb = hex.replace("#", "").match(/.{2}/g)?.map((c) => {
      const v = parseInt(c, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }) ?? [0, 0, 0];
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return cr >= ratio;
}
