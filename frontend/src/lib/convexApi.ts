/**
 * Central re-export of all Convex API references.
 * Import from here instead of using the generated api object directly,
 * so we have one place to update if function paths change.
 */
import { api } from "../../convex/_generated/api";
export { api };

// Re-export Convex hooks for convenience
export { useQuery, useMutation, useAction } from "convex/react";
