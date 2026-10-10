/**
 * Sidebar hubs a PI can switch on or off for each of their students.
 * Shared by the Convex functions and the frontend so both use the same names.
 */
export const HUBS = ["Lab Hub", "Sample Hub", "Grant Hub", "Safety & Quality", "Resources"] as const;
export type Hub = (typeof HUBS)[number];

/** What a newly added student can use until their PI changes it. */
export const DEFAULT_HUBS: Hub[] = ["Lab Hub", "Sample Hub"];

export const isHub = (h: string): h is Hub => (HUBS as readonly string[]).includes(h);
