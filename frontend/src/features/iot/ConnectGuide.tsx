import { useState } from 'react';
import toast from 'react-hot-toast';
import { presetById, type Preset } from './presets';
import { curlTest, esp32Code, piCode, PI_SERVICE, siteUrl, type Platform } from './snippets';

function CodeBlock({ text }: { text: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn btn-sm btn-secondary" style={{ position: 'absolute', top: 8, right: 8 }}
        onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Copied'), () => toast.error('Could not copy'))}>Copy</button>
      <pre style={{ margin: 0, padding: '14px 14px', paddingRight: 70, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', maxHeight: 360, fontSize: 12, lineHeight: 1.5 }}><code>{text}</code></pre>
    </div>
  );
}

/** Hardware, wiring and code for one sensor, with its key filled in when it is known. */
export function ConnectGuide({ presetId, sensorKey, generic }: { presetId?: string; sensorKey?: string; generic?: boolean }) {
  const preset: Preset = presetById(presetId) ?? presetById('custom')!;
  const [platform, setPlatform] = useState<Platform>('esp32');
  const tabs: Array<[Platform, string]> = [['esp32', 'ESP32'], ['pi', 'Raspberry Pi'], ['curl', 'Test from a computer']];
  return (
    <div style={{ display: 'grid', gap: 18, fontSize: 14 }}>
      {!sensorKey && !generic && <p className="auth-note warn" style={{ margin: 0 }}>Your key was only shown when this sensor was created. Paste it where the code says PASTE_YOUR_SENSOR_KEY_HERE, or use “New key” to get another.</p>}

      <section>
        <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>1. What you need — {preset.label}</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{preset.hardware.map((h) => <li key={h}>{h}</li>)}</ul>
        {preset.note && <p style={{ color: 'var(--text-muted)', margin: '8px 0 0' }}>{preset.note}</p>}
      </section>

      <section>
        <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>2. Wire it</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{preset.wiring.map((w) => <li key={w}>{w}</li>)}</ul>
      </section>

      <section>
        <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>3. Put the code on the device</h3>
        <div role="tablist" aria-label="Device type" style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={platform === id} className={`btn btn-sm ${platform === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlatform(id)}>{label}</button>
          ))}
        </div>
        {platform === 'esp32' && (
          <>
            <ol style={{ margin: '0 0 10px', paddingLeft: 18 }}>
              <li>Install the Arduino IDE and add “ESP32” in Boards Manager.</li>
              <li>Install the libraries named at the top of the code (Sketch → Include Library → Manage Libraries).</li>
              <li>Paste the code, fill in your Wi-Fi name and password, press Upload.</li>
              <li>Open Serial Monitor at 115200: “HTTP 200” means LabOS stored the reading.</li>
            </ol>
            <CodeBlock text={esp32Code(preset.code, sensorKey)} />
          </>
        )}
        {platform === 'pi' && (
          <>
            <ol style={{ margin: '0 0 10px', paddingLeft: 18 }}>
              <li>Enable what your sensor needs: <code>sudo raspi-config</code> → Interface Options → SPI (PT100) or 1-Wire (DS18B20) or I²C.</li>
              <li>Save the code as <code>sensor.py</code> and run <code>python3 sensor.py</code>. “200” means stored.</li>
              <li>To start it at boot, add the service below.</li>
            </ol>
            <CodeBlock text={piCode(preset.code, sensorKey)} />
            <div style={{ height: 10 }} />
            <CodeBlock text={PI_SERVICE} />
          </>
        )}
        {platform === 'curl' && (
          <>
            <p style={{ margin: '0 0 10px' }}>Check the connection before you wire anything. Run this in a terminal; the sensor card should show the value within a few seconds.</p>
            <CodeBlock text={curlTest(sensorKey)} />
          </>
        )}
      </section>

      <section style={{ color: 'var(--text-muted)' }}>
        <h3 style={{ fontSize: 14, margin: '0 0 6px', color: 'var(--text)' }}>How it works</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>The device sends <code>{`{"value": -79.6}`}</code> to <code>{siteUrl() || 'your LabOS address'}/iot/reading</code> with its key. No user login is stored on the device.</li>
          <li>One reading every 30 seconds is plenty (the limit is one every 5 seconds).</li>
          <li>If a reading goes past a limit you get an alert here and on the dashboard. If the device goes quiet you get an “offline” alert.</li>
          <li>Treat the key like a password. If it leaks, press “New key”: the old one stops working at once.</li>
          <li>This is a monitoring aid, not a certified alarm. Keep your freezer’s own alarm and check it regularly.</li>
        </ul>
      </section>
    </div>
  );
}
