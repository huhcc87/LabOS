import { useEffect, useRef, useState, useCallback } from 'react';

export interface SensorFrame {
  type: 'reading' | 'mqtt' | 'ping';
  sensor_id?: number;
  sensor_key?: string;
  sensor_name?: string;
  unit?: string;
  value?: number;
  status?: 'normal' | 'warning' | 'critical' | 'offline';
  recorded_at?: string;
  data?: Record<string, unknown>;
}

type ConnState = 'connecting' | 'open' | 'closed' | 'error';

const WS_URL = (() => {
  const base = import.meta.env.VITE_API_URL ?? '';
  if (base) return base.replace(/^http/, 'ws') + '/api/iot/ws';
  const loc = window.location;
  const proto = loc.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${loc.host}/api/iot/ws`;
})();

export function useIoTWebSocket(maxHistory = 200) {
  const [frames, setFrames]   = useState<SensorFrame[]>([]);
  const [connState, setConnState] = useState<ConnState>('closed');
  const wsRef    = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnState('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen  = () => setConnState('open');
    ws.onerror = () => setConnState('error');
    ws.onclose = () => {
      setConnState('closed');
      // Auto-reconnect after 5 s
      timerRef.current = setTimeout(connect, 5000);
    };
    ws.onmessage = (ev) => {
      try {
        const frame: SensorFrame = JSON.parse(ev.data);
        if (frame.type === 'ping') return;
        setFrames((prev) => [frame, ...prev].slice(0, maxHistory));
      } catch {
        // ignore malformed frames
      }
    };
  }, [maxHistory]);

  const disconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnState('closed');
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { frames, connState, reconnect: connect, disconnect };
}
