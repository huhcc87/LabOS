import toast from 'react-hot-toast';

/**
 * Show a "coming soon" toast for features not yet implemented.
 * Usage: <button onClick={() => comingSoon('ORCID Import')}>Import from ORCID</button>
 */
export function comingSoon(featureName?: string) {
  const msg = featureName
    ? `${featureName} is coming soon`
    : 'This feature is coming soon';
  try {
    toast(msg, { icon: '🚧', duration: 2000 });
  } catch {
    // Fallback if toast system isn't ready
    console.info(`[LabOS] ${msg}`);
  }
}
