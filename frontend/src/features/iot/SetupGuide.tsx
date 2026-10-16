import { useState } from 'react';
import { PRESETS } from './presets';
import { ConnectGuide } from './ConnectGuide';
import { siteUrl } from './snippets';

const STEPS = [
  'Pick the sensor type below and buy the parts listed (about 15–40 USD each).',
  'Press “+ Add sensor”, choose the type, name it and save. LabOS shows the sensor key once — copy it.',
  'Wire the probe to an ESP32 or Raspberry Pi as shown for that type.',
  'Paste the ready-made code (your key is filled in when you open it from “+ Add sensor”), set your Wi-Fi, and upload or run it.',
  'Within a minute the card on this page shows the reading. “Waiting for data” means nothing has arrived yet.',
];

const TROUBLE = [
  'Serial Monitor says HTTP 401 → the key is wrong or was replaced. Open the sensor and press “New key”.',
  'HTTP 429 → readings are coming faster than one every 5 seconds. Raise the delay in the code.',
  'No answer at all → the device is not on Wi-Fi, or the address is wrong. Check it from a computer with the “Test from a computer” tab.',
  'Value looks wrong (e.g. −245 or 850) → the probe is not wired as shown. Check the amplifier board wiring first.',
  'Sensor shows Offline → the device stopped sending. Check power and Wi-Fi.',
];

/** Collapsible how-to for every sensor type: parts, wiring, code. Works before any sensor exists. */
export function SetupGuide() {
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  return (
    <div className="card" style={{ marginBottom: 16, padding: 14 }}>
      <button type="button" className="btn btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'} setup guide: how to add and connect each sensor
      </button>
      {open && (
        <div style={{ display: 'grid', gap: 16, marginTop: 14 }}>
          <section>
            <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>The 5 steps (same for every sensor)</h3>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 0' }}>
              Devices send readings to <code>{siteUrl() || 'your LabOS address'}/iot/reading</code>. Check that it is reachable with <code>{siteUrl() || 'your LabOS address'}/iot/ping</code>.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Choose your sensor</h3>
            <div role="tablist" aria-label="Sensor type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {PRESETS.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={presetId === p.id}
                  className={`btn btn-sm ${presetId === p.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPresetId(p.id)}>{p.label}</button>
              ))}
            </div>
            <ConnectGuide presetId={presetId} generic />
          </section>

          <section>
            <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>If it does not work</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{TROUBLE.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
