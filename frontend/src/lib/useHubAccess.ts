import { useEffect, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { HUBS } from '../../convex/hubs';

export interface HubAccess {
  restricted: boolean;
  hubs: string[];
  piName: string | null;
}

const OPEN: HubAccess = { restricted: false, hubs: [...HUBS], piName: null };

/**
 * Which hubs the signed-in user may open. Students see only what their PI allows.
 * ponytail: fetched once per sign-in, not live — a PI's change reaches the student on their next page load.
 * Fails open (everything visible) if the backend function isn't deployed yet, so the app never locks up.
 */
export function useHubAccess(token: string | null): HubAccess {
  const convex = useConvex();
  const [access, setAccess] = useState<HubAccess>(OPEN);

  useEffect(() => {
    if (!token) { setAccess(OPEN); return; }
    let alive = true;
    convex.query(api.piAccess.myAccess, { token })
      .then(a => { if (alive) setAccess(a); })
      .catch(() => { if (alive) setAccess(OPEN); });
    return () => { alive = false; };
  }, [convex, token]);

  return access;
}
