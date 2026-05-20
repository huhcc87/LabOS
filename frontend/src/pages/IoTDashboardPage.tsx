import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';

// ─── Types ───────────────────────────────────────────────────────────────────
type DeviceStatus = 'normal' | 'warning' | 'critical' | 'offline';

interface Sensor {
  id: string;
  name: string;
  location: string;
  type: 'freezer' | 'incubator' | 'fridge' | 'ln2' | 'co2' | 'humidity';
  icon: string;
  unit: string;
  target: number;
  min: number;
  max: number;
  current: number;
  status: DeviceStatus;
  lastUpdated: string;
  battery?: number;
  history: number[];
}

interface Alert {
  id: string;
  sensorId: string;
  sensorName: string;
  type: 'warning' | 'critical';
  message: string;
  time: string;
  acknowledged: boolean;
}

// ─── Install guide (shared by in-page modal + DOCX download) ─────────────────
interface InstallSection {
  title: string;
  emoji: string;
  total: string;
  items: { item: string; purpose: string; cost: string; search: string }[];
  software: string[];
  notes?: string;
}

const INSTALL_SECTIONS: InstallSection[] = [
  {
    title: 'ULT Freezer (−80°C)', emoji: '🧊', total: '~$100–$110 per unit',
    notes: 'Most common LabOS sensor. Use a PT100 probe for accuracy down to liquid-N₂ range.',
    items: [
      { item: 'Raspberry Pi 4 Model B (2GB)', purpose: 'Gateway computer', cost: '~$45', search: 'amazon.com/s?k=raspberry+pi+4+2gb' },
      { item: 'MAX31865 PT100/PT1000 RTD HAT', purpose: 'Read PT100 probe via SPI', cost: '~$12', search: 'amazon.com/s?k=max31865+rtd+hat+raspberry+pi' },
      { item: 'PT100 Stainless Steel Probe (−200°C to +200°C)', purpose: 'Temperature measurement', cost: '~$15', search: 'amazon.com/s?k=pt100+stainless+steel+probe+temperature' },
      { item: 'Magnetic Reed Switch (10-pack)', purpose: 'Door open/close (optional)', cost: '~$8', search: 'amazon.com/s?k=magnetic+reed+switch+sensor' },
      { item: '32GB microSD card', purpose: 'Pi OS storage', cost: '~$8', search: 'amazon.com/s?k=32gb+microsd+card' },
      { item: '5V 3A USB-C power supply', purpose: 'Power the Pi', cost: '~$10', search: 'amazon.com/s?k=raspberry+pi+power+supply+usb-c+5v+3a' },
      { item: 'Waterproof Cable Gland PG7 (10-pack)', purpose: 'Feed probe through freezer wall', cost: '~$8', search: 'amazon.com/s?k=pg7+cable+gland+waterproof' },
    ],
    software: ['adafruit-circuitpython-max31865', 'adafruit-blinka', 'requests'],
  },
  {
    title: '−20°C Freezer', emoji: '❄️', total: '~$50–$60 per unit',
    notes: 'Cheapest setup. DS18B20 is reliable down to −55°C — perfect for −20°C freezers.',
    items: [
      { item: 'Raspberry Pi Zero 2 W', purpose: 'Smaller/cheaper gateway', cost: '~$15', search: 'amazon.com/s?k=raspberry+pi+zero+2w' },
      { item: 'DS18B20 Waterproof Temperature Probe', purpose: 'Temp sensing (works to −55°C)', cost: '~$10', search: 'amazon.com/s?k=ds18b20+waterproof+temperature+sensor+probe' },
      { item: '4.7kΩ resistor pack', purpose: 'Required pull-up for DS18B20 1-Wire', cost: '~$1', search: 'amazon.com/s?k=4.7k+ohm+resistor+pack' },
      { item: 'Magnetic Reed Switch (10-pack)', purpose: 'Door sensor (optional)', cost: '~$8', search: 'amazon.com/s?k=magnetic+reed+switch+sensor' },
      { item: '16GB microSD card', purpose: 'Pi OS storage', cost: '~$6', search: 'amazon.com/s?k=16gb+microsd+card' },
      { item: '5V 2.5A micro-USB power supply', purpose: 'Pi Zero power', cost: '~$8', search: 'amazon.com/s?k=raspberry+pi+zero+power+supply+micro+usb+5v' },
      { item: 'Waterproof Cable Gland PG7 (10-pack)', purpose: 'Probe cable entry', cost: '~$8', search: 'amazon.com/s?k=pg7+cable+gland+waterproof' },
    ],
    software: ['w1thermsensor', 'requests', 'Enable dtoverlay=w1-gpio in /boot/config.txt'],
  },
  {
    title: 'CO₂ Incubator + CO₂ Level', emoji: '🦠', total: '~$90–$110 per unit',
    notes: 'Pair temperature (PT100 or SHT31) with a CO₂ NDIR sensor. SCD40 is the modern Sensirion choice.',
    items: [
      { item: 'Raspberry Pi 4 Model B (2GB)', purpose: 'Gateway', cost: '~$45', search: 'amazon.com/s?k=raspberry+pi+4+2gb' },
      { item: 'Sensirion SCD40 CO₂ Sensor (I²C)', purpose: 'CO₂ in ppm, plus T/RH', cost: '~$45', search: 'amazon.com/s?k=sensirion+scd40+co2+sensor' },
      { item: 'SHT31-D Temp + RH Sensor (I²C)', purpose: 'Backup temp/humidity', cost: '~$12', search: 'amazon.com/s?k=sht31+i2c+temperature+humidity' },
      { item: 'PG7 cable gland', purpose: 'Sensor cable entry through door seal', cost: '~$3', search: 'amazon.com/s?k=pg7+cable+gland+waterproof' },
      { item: '32GB microSD + 5V 3A power supply', purpose: 'Storage and power', cost: '~$18', search: 'amazon.com/s?k=32gb+microsd+card' },
    ],
    software: ['adafruit-circuitpython-scd4x', 'adafruit-circuitpython-sht31d', 'requests'],
  },
  {
    title: 'LN₂ Dewar', emoji: '💧', total: '~$140–$160 per unit',
    notes: 'Always pair with an O₂ depletion sensor for safety. NEVER install LN₂ monitoring without one.',
    items: [
      { item: 'Raspberry Pi 4 Model B (2GB)', purpose: 'Gateway', cost: '~$45', search: 'amazon.com/s?k=raspberry+pi+4+2gb' },
      { item: 'Capacitance Liquid Level Sensor (DFRobot SEN0257)', purpose: 'LN₂ level 0–100%', cost: '~$30', search: 'amazon.com/s?k=capacitance+liquid+level+sensor+dfrobot' },
      { item: 'PT100 Stainless Steel Probe', purpose: 'Verify LN₂ temp (−196°C, optional)', cost: '~$15', search: 'amazon.com/s?k=pt100+stainless+steel+probe+temperature' },
      { item: 'O₂ Depletion Sensor (DFRobot O2)', purpose: 'Safety — O₂ level monitoring', cost: '~$25', search: 'amazon.com/s?k=oxygen+sensor+module+o2+mq' },
      { item: 'ADS1115 16-bit ADC', purpose: 'Read analog O₂ sensor on Pi', cost: '~$8', search: 'amazon.com/s?k=ads1115+i2c+adc+raspberry+pi' },
      { item: '32GB microSD + 5V 3A power supply', purpose: 'Storage and power', cost: '~$18', search: 'amazon.com/s?k=32gb+microsd+card' },
    ],
    software: ['adafruit-circuitpython-ads1x15', 'adafruit-circuitpython-max31865', 'adafruit-blinka', 'requests'],
  },
  {
    title: 'Sample Fridge (+4°C)', emoji: '🧪', total: '~$50–$60 per unit',
    notes: 'Lightweight Pi Zero setup. SHT31 gives both temp and humidity in one I²C device.',
    items: [
      { item: 'Raspberry Pi Zero 2 W', purpose: 'Lightweight gateway', cost: '~$15', search: 'amazon.com/s?k=raspberry+pi+zero+2w' },
      { item: 'DS18B20 Waterproof Temperature Probe', purpose: 'Temperature', cost: '~$10', search: 'amazon.com/s?k=ds18b20+waterproof+temperature+sensor+probe' },
      { item: 'SHT31 Temperature + Humidity Sensor', purpose: 'Internal humidity (optional)', cost: '~$12', search: 'amazon.com/s?k=sht31+temperature+humidity+sensor+i2c' },
      { item: 'Magnetic Reed Switch (10-pack)', purpose: 'Door sensor (optional)', cost: '~$8', search: 'amazon.com/s?k=magnetic+reed+switch+sensor' },
      { item: '16GB microSD + micro-USB power supply', purpose: 'Storage and power', cost: '~$14', search: 'amazon.com/s?k=16gb+microsd+card' },
    ],
    software: ['w1thermsensor', 'adafruit-circuitpython-sht31d', 'requests'],
  },
];

const PI_SETUP_STEPS = [
  'Flash Raspberry Pi OS Lite to microSD using Raspberry Pi Imager',
  'Enable SSH and configure Wi-Fi in Raspberry Pi Imager settings',
  'SSH into Pi: ssh pi@<ip-address>',
  'Install Python deps: pip install requests adafruit-blinka (add sensor-specific libs)',
  'Copy pi_sensor.py and create pi_sensor.env with LABOS_URL, SENSOR_KEY, API_KEY, INTERVAL',
  'Test manually: python pi_sensor.py',
  'Enable systemd service for auto-start on boot (see pi_sensor.py comments)',
];

// ─── Status meta ─────────────────────────────────────────────────────────────
const STATUS_META: Record<DeviceStatus, { label: string; color: string; bg: string; dot: string }> = {
  normal:   { label: 'Normal',   color: '#4ade80', bg: 'rgba(34,197,94,0.12)',   dot: '#4ade80' },
  warning:  { label: 'Warning',  color: '#fbbf24', bg: 'rgba(234,179,8,0.12)',   dot: '#fbbf24' },
  critical: { label: 'Critical', color: '#f87171', bg: 'rgba(239,68,68,0.15)',   dot: '#ef4444' },
  offline:  { label: 'Offline',  color: '#9ca3af', bg: 'rgba(107,114,128,0.12)', dot: '#6b7280' },
};

function genHistory(base: number, noise: number, len = 24): number[] {
  return Array.from({ length: len }, (_, i) => parseFloat((base + (Math.random() - 0.5) * noise * 2 * Math.sin(i / 4)).toFixed(1)));
}

const INITIAL_SENSORS: Sensor[] = [
  { id: 's1', name: 'Freezer ULT-1', location: 'Room 204', type: 'freezer', icon: '🧊', unit: '°C', target: -80, min: -85, max: -70, current: -79.3, status: 'normal', lastUpdated: 'just now', battery: 88, history: genHistory(-80, 2) },
  { id: 's2', name: 'Freezer ULT-2', location: 'Room 204', type: 'freezer', icon: '🧊', unit: '°C', target: -80, min: -85, max: -70, current: -68.1, status: 'critical', lastUpdated: '2 min ago', battery: 72, history: genHistory(-75, 5) },
  { id: 's3', name: 'CO₂ Incubator A', location: 'Room 201', type: 'incubator', icon: '🦠', unit: '°C', target: 37, min: 36.5, max: 37.5, current: 37.1, status: 'normal', lastUpdated: 'just now', battery: 95, history: genHistory(37, 0.3) },
  { id: 's4', name: 'CO₂ Incubator B', location: 'Room 203', type: 'incubator', icon: '🦠', unit: '°C', target: 37, min: 36.5, max: 37.5, current: 37.8, status: 'warning', lastUpdated: '5 min ago', battery: 61, history: genHistory(37.5, 0.4) },
  { id: 's5', name: 'CO₂ Level A', location: 'Room 201', type: 'co2', icon: '💨', unit: '%', target: 5, min: 4.8, max: 5.2, current: 5.0, status: 'normal', lastUpdated: 'just now', battery: 90, history: genHistory(5, 0.1) },
  { id: 's6', name: 'LN₂ Tank Level', location: 'Storage B', type: 'ln2', icon: '❄️', unit: '%', target: 70, min: 20, max: 100, current: 42, status: 'warning', lastUpdated: '10 min ago', battery: 80, history: genHistory(45, 3) },
  { id: 's7', name: 'Sample Fridge', location: 'Room 202', type: 'fridge', icon: '🌡️', unit: '°C', target: 4, min: 2, max: 8, current: 4.2, status: 'normal', lastUpdated: 'just now', battery: 100, history: genHistory(4, 0.5) },
  { id: 's8', name: 'Lab Humidity', location: 'Room 201', type: 'humidity', icon: '💧', unit: '%RH', target: 45, min: 30, max: 60, current: 55, status: 'normal', lastUpdated: '1 min ago', battery: 77, history: genHistory(45, 5) },
];

const INITIAL_ALERTS: Alert[] = [
  { id: 'a1', sensorId: 's2', sensorName: 'Freezer ULT-2', type: 'critical', message: 'Temperature -68.1°C exceeds threshold (-70°C). Check door seal and compressor.', time: '5 min ago', acknowledged: false },
  { id: 'a2', sensorId: 's4', sensorName: 'CO₂ Incubator B', type: 'warning', message: 'Temperature 37.8°C slightly above target. Monitor closely.', time: '12 min ago', acknowledged: false },
  { id: 'a3', sensorId: 's6', sensorName: 'LN₂ Tank Level', type: 'warning', message: 'Liquid nitrogen level at 42%. Schedule refill soon.', time: '18 min ago', acknowledged: true },
];

// ─── Mini sparkline ───────────────────────────────────────────────────────────
function Sparkline({ data, color, min, max }: { data: number[]; color: string; min: number; max: number }) {
  const W = 120, H = 36;
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${Math.max(2, Math.min(H - 2, y))}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

// ─── Gauge arc ───────────────────────────────────────────────────────────────
function GaugeArc({ value, min, max, color }: { value: number; min: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -140 + pct * 280;
  const r = 40, cx = 50, cy = 52;
  const toXY = (deg: number) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = toXY(-140), end = toXY(angle);
  const largeArc = pct > 0.5 ? 1 : 0;
  return (
    <svg width={100} height={70} style={{ display: 'block', margin: '0 auto' }}>
      <path d={`M ${toXY(-140).x} ${toXY(-140).y} A ${r} ${r} 0 1 1 ${toXY(140).x} ${toXY(140).y}`} fill="none" stroke="var(--border)" strokeWidth={6} strokeLinecap="round" />
      {pct > 0 && <path d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />}
    </svg>
  );
}

// ─── Equipment templates ──────────────────────────────────────────────────────
const EQUIPMENT_TEMPLATES = [
  {
    id: 'ult',
    label: '🧊 ULT Freezer (-80°C)',
    sensor_type: 'freezer', unit: '°C', target: '-80', min: '-85', max: '-70',
    keyPrefix: 'ult-freezer',
    nameSuffix: 'ULT Freezer',
    sensors: [
      { label: 'Temperature (PT100 probe)', required: true },
      { label: 'Door open (reed switch)', required: false },
    ],
    hw: 'Raspberry Pi + MAX31865 + PT100 probe (-200°C to +200°C, stainless steel)',
  },
  {
    id: 'minus20',
    label: '❄️ -20°C Freezer',
    sensor_type: 'freezer', unit: '°C', target: '-20', min: '-25', max: '-15',
    keyPrefix: 'minus20-freezer',
    nameSuffix: '-20°C Freezer',
    sensors: [
      { label: 'Temperature (DS18B20 or PT100)', required: true },
      { label: 'Door open (reed switch)', required: false },
    ],
    hw: 'Raspberry Pi + DS18B20 waterproof probe (cheaper option for -20°C)',
  },
  {
    id: 'ln2',
    label: '💨 LN₂ Dewar',
    sensor_type: 'ln2', unit: '%', target: '70', min: '20', max: '100',
    keyPrefix: 'ln2-dewar',
    nameSuffix: 'LN₂ Dewar',
    sensors: [
      { label: 'Liquid level (capacitance sensor)', required: true },
      { label: 'O₂ depletion (oxygen sensor — safety)', required: false },
    ],
    hw: 'Raspberry Pi + SEN0257 capacitance liquid level sensor',
  },
  {
    id: 'fridge',
    label: '🌡️ Sample Fridge (+4°C)',
    sensor_type: 'fridge', unit: '°C', target: '4', min: '2', max: '8',
    keyPrefix: 'sample-fridge',
    nameSuffix: 'Sample Fridge',
    sensors: [
      { label: 'Temperature (DS18B20)', required: true },
      { label: 'Humidity (SHT31)', required: false },
    ],
    hw: 'Raspberry Pi Zero 2W + DS18B20 waterproof probe',
  },
] as const;

// ─── Register Sensor Panel ────────────────────────────────────────────────────
function RegisterSensorPanel({ token, onCreated }: { token: string | null; onCreated: () => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('ult');
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [cooldown, setCooldown] = useState('30');
  const [results, setResults] = useState<{ sensor_key: string; api_key: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const INP: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };

  const tmpl = EQUIPMENT_TEMPLATES.find(t => t.id === selectedTemplate)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setProgress(0);
    const registered: { sensor_key: string; api_key: string; name: string }[] = [];
    try {
      for (let i = 1; i <= quantity; i++) {
        const suffix = quantity > 1 ? ` ${i}` : '';
        const body = {
          sensor_key: `${tmpl.keyPrefix}${quantity > 1 ? `-${i}` : ''}`,
          name: `${tmpl.nameSuffix}${suffix}`,
          location,
          sensor_type: tmpl.sensor_type,
          unit: tmpl.unit,
          target: parseFloat(tmpl.target),
          min_threshold: parseFloat(tmpl.min),
          max_threshold: parseFloat(tmpl.max),
          notify_email: notifyEmail,
          alert_cooldown_minutes: parseInt(cooldown),
        };
        const res = await fetch('/api/iot/sensors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Failed sensor ${i}`); }
        const data = await res.json();
        registered.push({ sensor_key: data.sensor_key, api_key: data.api_key, name: data.name });
        setProgress(i);
      }
      setResults(registered);
      onCreated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  if (results.length > 0) return (
    <div className="card" style={{ marginBottom: 20, borderColor: '#4ade80' }}>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>
        ✅ {results.length} sensor{results.length > 1 ? 's' : ''} registered!
      </h4>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        Create one <code>pi_sensor.env</code> per Pi using the keys below. Each Pi posts independently.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {results.map((r, i) => (
          <div key={r.sensor_key} style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pi {i + 1} — {r.name}</div>
            <pre style={{ fontSize: 11, margin: 0, overflowX: 'auto', lineHeight: 1.7 }}>
{`LABOS_URL=http://YOUR_SERVER_IP:8000
SENSOR_KEY=${r.sensor_key}
API_KEY=${r.api_key}
INTERVAL=30`}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Register Pi Sensors</h4>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Pick equipment type, set quantity — each unit gets its own Pi and API key.</p>

      {/* Equipment type picker */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
        {EQUIPMENT_TEMPLATES.map(t => (
          <button key={t.id} type="button" onClick={() => setSelectedTemplate(t.id)}
            style={{ padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', border: `2px solid ${selectedTemplate === t.id ? 'var(--primary)' : 'var(--border)'}`, background: selectedTemplate === t.id ? 'rgba(99,102,241,0.1)' : 'var(--surface2)', color: 'var(--text)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Template info */}
      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Sensors for {tmpl.label}:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tmpl.sensors.map(s => (
            <div key={s.label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: s.required ? '#4ade80' : '#fbbf24' }}>{s.required ? '● Required' : '○ Optional'}</span>
              <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          🔧 <strong>Hardware:</strong> {tmpl.hw}
        </div>
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            How many do you have?
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1,2,3,4,5,6].map(n => (
              <button key={n} type="button" onClick={() => setQuantity(n)}
                style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `2px solid ${quantity === n ? 'var(--primary)' : 'var(--border)'}`, background: quantity === n ? 'var(--primary)' : 'var(--surface2)', color: quantity === n ? '#fff' : 'var(--text)' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Room / Location</label>
          <input style={INP} placeholder="Room 204" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Alert Email(s)</label>
          <input style={INP} placeholder="pi@lab.local, manager@lab.local" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Alert Cooldown (min)</label>
          <input type="number" min="5" style={INP} value={cooldown} onChange={e => setCooldown(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
          <button type="submit" disabled={saving}
            style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? `Registering ${progress}/${quantity}…` : `Register ${quantity} Sensor${quantity > 1 ? 's' : ''} & Get API Keys`}
          </button>
        </div>
      </form>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

// ─── API types ────────────────────────────────────────────────────────────────
interface APISensor {
  id: number; sensor_key: string; name: string; location: string;
  sensor_type: string; unit: string; target: number;
  min_threshold: number; max_threshold: number;
  current_value: number | null; current_status: string;
  last_updated: string | null; api_key: string;
  notify_email: string; alert_cooldown_minutes: number; unack_alerts: number;
}

interface APIAlert {
  id: number; sensor_id: number; sensor_name: string;
  severity: 'warning' | 'critical'; value: number; message: string;
  triggered_at: string; acknowledged: boolean; notified_emails: string;
}

const TYPE_ICONS: Record<string, string> = { freezer: '🧊', incubator: '🦠', fridge: '🌡️', ln2: '❄️', co2: '💨', humidity: '💧' };

function apiToSensor(a: APISensor): Sensor {
  const cur = a.current_value ?? a.target;
  const st = (a.current_status as DeviceStatus) || 'offline';
  return {
    id: String(a.id), name: a.name, location: a.location,
    type: a.sensor_type as Sensor['type'],
    icon: TYPE_ICONS[a.sensor_type] ?? '📡',
    unit: a.unit, target: a.target,
    min: a.min_threshold, max: a.max_threshold,
    current: cur, status: st,
    lastUpdated: a.last_updated ? new Date(a.last_updated).toLocaleTimeString() : 'never',
    history: genHistory(cur, Math.abs(a.max_threshold - a.min_threshold) * 0.05),
  };
}

export default function IoTDashboardPage() {
  const [sensors, setSensors] = useState<Sensor[]>(INITIAL_SENSORS);
  const [apiSensors, setApiSensors] = useState<APISensor[]>([]);
  const [usingRealApi, setUsingRealApi] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [realAlerts, setRealAlerts] = useState<APIAlert[]>([]);
  const [selected, setSelected] = useState<Sensor | null>(null);
  const [selectedApiSensor, setSelectedApiSensor] = useState<APISensor | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | DeviceStatus>('all');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showRegister, setShowRegister] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [guideSectionIdx, setGuideSectionIdx] = useState(0);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [notifyEmailDraft, setNotifyEmailDraft] = useState('');
  const timerRef = useRef<number | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchRealAlerts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/iot/alerts?limit=30', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setRealAlerts(await res.json());
    } catch { /* silent */ }
  }, [token]);

  const fetchRealSensors = useCallback(async () => {
    if (!token) return false;
    try {
      const res = await fetch('/api/iot/sensors', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return false;
      const data: APISensor[] = await res.json();
      if (data.length === 0) return false;
      setApiSensors(data);
      setSensors(data.map(apiToSensor));
      setLastRefresh(new Date());
      return true;
    } catch { return false; }
  }, [token]);

  useEffect(() => {
    fetchRealSensors().then(ok => {
      setUsingRealApi(ok);
      if (ok) fetchRealAlerts();
      if (!ok) {
        timerRef.current = window.setInterval(() => {
          setSensors(prev => prev.map(s => {
            if (s.status === 'offline') return s;
            const drift = (Math.random() - 0.5) * 0.4;
            const newVal = parseFloat((s.current + drift).toFixed(1));
            let newStatus: DeviceStatus = 'normal';
            if (newVal < s.min || newVal > s.max) newStatus = 'critical';
            else if (newVal < s.min + (s.max - s.min) * 0.1 || newVal > s.max - (s.max - s.min) * 0.1) newStatus = 'warning';
            return { ...s, current: newVal, status: newStatus, lastUpdated: 'just now', history: [...s.history.slice(1), newVal] };
          }));
          setLastRefresh(new Date());
        }, 5000);
      } else {
        timerRef.current = window.setInterval(() => {
          fetchRealSensors();
          fetchRealAlerts();
        }, 30000);
      }
    });
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchRealSensors, fetchRealAlerts]);

  const ackAlert = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  const dismissAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  const ackRealAlert = async (id: number) => {
    if (!token) return;
    await fetch(`/api/iot/alerts/${id}/acknowledge`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setRealAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const saveNotifyEmail = async () => {
    if (!token || !selectedApiSensor) return;
    setSavingThresholds(true);
    try {
      await fetch(`/api/iot/sensors/${selectedApiSensor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notify_email: notifyEmailDraft }),
      });
      setApiSensors(prev => prev.map(s => s.id === selectedApiSensor.id ? { ...s, notify_email: notifyEmailDraft } : s));
      setSelectedApiSensor(prev => prev ? { ...prev, notify_email: notifyEmailDraft } : null);
    } finally { setSavingThresholds(false); }
  };

  const downloadHardwareGuide = async () => {
    type EquipmentSection = {
      title: string;
      total: string;
      items: { item: string; purpose: string; cost: string; search: string }[];
      software: string[];
    };

    const sections: EquipmentSection[] = [
      {
        title: 'ULT Freezer (−80°C)',
        total: '~$100–$110 per unit',
        items: [
          { item: 'Raspberry Pi 4 Model B (2GB)', purpose: 'Gateway computer', cost: '~$45', search: 'amazon.com/s?k=raspberry+pi+4+2gb' },
          { item: 'MAX31865 PT100/PT1000 RTD HAT', purpose: 'Read PT100 probe via SPI', cost: '~$12', search: 'amazon.com/s?k=max31865+rtd+hat+raspberry+pi' },
          { item: 'PT100 Stainless Steel Probe (−200°C to +200°C)', purpose: 'Temperature measurement', cost: '~$15', search: 'amazon.com/s?k=pt100+stainless+steel+probe+temperature' },
          { item: 'Magnetic Reed Switch (10-pack)', purpose: 'Door open/close (optional)', cost: '~$8', search: 'amazon.com/s?k=magnetic+reed+switch+sensor' },
          { item: '32GB microSD card', purpose: 'Pi OS storage', cost: '~$8', search: 'amazon.com/s?k=32gb+microsd+card' },
          { item: '5V 3A USB-C power supply', purpose: 'Power the Pi', cost: '~$10', search: 'amazon.com/s?k=raspberry+pi+power+supply+usb-c+5v+3a' },
          { item: 'Waterproof Cable Gland PG7 (10-pack)', purpose: 'Feed probe cable through freezer wall', cost: '~$8', search: 'amazon.com/s?k=pg7+cable+gland+waterproof' },
        ],
        software: ['adafruit-circuitpython-max31865', 'adafruit-blinka', 'requests'],
      },
      {
        title: '−20°C Freezer',
        total: '~$50–$60 per unit',
        items: [
          { item: 'Raspberry Pi Zero 2 W', purpose: 'Smaller/cheaper gateway', cost: '~$15', search: 'amazon.com/s?k=raspberry+pi+zero+2w' },
          { item: 'DS18B20 Waterproof Temperature Probe', purpose: 'Temp sensing (works to −55°C)', cost: '~$10', search: 'amazon.com/s?k=ds18b20+waterproof+temperature+sensor+probe' },
          { item: '4.7kΩ resistor pack', purpose: 'Required pull-up for DS18B20 1-Wire', cost: '~$1', search: 'amazon.com/s?k=4.7k+ohm+resistor+pack' },
          { item: 'Magnetic Reed Switch (10-pack)', purpose: 'Door sensor (optional)', cost: '~$8', search: 'amazon.com/s?k=magnetic+reed+switch+sensor' },
          { item: '16GB microSD card', purpose: 'Pi OS storage', cost: '~$6', search: 'amazon.com/s?k=16gb+microsd+card' },
          { item: '5V 2.5A micro-USB power supply', purpose: 'Pi Zero power', cost: '~$8', search: 'amazon.com/s?k=raspberry+pi+zero+power+supply+micro+usb+5v' },
          { item: 'Waterproof Cable Gland PG7 (10-pack)', purpose: 'Probe cable entry', cost: '~$8', search: 'amazon.com/s?k=pg7+cable+gland+waterproof' },
        ],
        software: ['w1thermsensor', 'requests', 'Enable dtoverlay=w1-gpio in /boot/config.txt'],
      },
      {
        title: 'LN₂ Dewar',
        total: '~$140–$160 per unit',
        items: [
          { item: 'Raspberry Pi 4 Model B (2GB)', purpose: 'Gateway', cost: '~$45', search: 'amazon.com/s?k=raspberry+pi+4+2gb' },
          { item: 'Capacitance Liquid Level Sensor (DFRobot SEN0257)', purpose: 'LN₂ level 0–100%', cost: '~$30', search: 'amazon.com/s?k=capacitance+liquid+level+sensor+dfrobot' },
          { item: 'PT100 Stainless Steel Probe', purpose: 'Verify LN₂ temp (−196°C, optional)', cost: '~$15', search: 'amazon.com/s?k=pt100+stainless+steel+probe+temperature' },
          { item: 'O₂ Depletion Sensor (DFRobot O2)', purpose: 'Safety — O₂ level monitoring', cost: '~$25', search: 'amazon.com/s?k=oxygen+sensor+module+o2+mq' },
          { item: 'ADS1115 16-bit ADC', purpose: 'Read analog O₂ sensor on Pi', cost: '~$8', search: 'amazon.com/s?k=ads1115+i2c+adc+raspberry+pi' },
          { item: '32GB microSD + 5V 3A power supply', purpose: 'Storage and power', cost: '~$18', search: 'amazon.com/s?k=32gb+microsd+card' },
        ],
        software: ['adafruit-circuitpython-ads1x15', 'adafruit-circuitpython-max31865', 'adafruit-blinka', 'requests'],
      },
      {
        title: 'Sample Fridge (+4°C)',
        total: '~$50–$60 per unit',
        items: [
          { item: 'Raspberry Pi Zero 2 W', purpose: 'Lightweight gateway', cost: '~$15', search: 'amazon.com/s?k=raspberry+pi+zero+2w' },
          { item: 'DS18B20 Waterproof Temperature Probe', purpose: 'Temperature', cost: '~$10', search: 'amazon.com/s?k=ds18b20+waterproof+temperature+sensor+probe' },
          { item: 'SHT31 Temperature + Humidity Sensor', purpose: 'Internal humidity (optional)', cost: '~$12', search: 'amazon.com/s?k=sht31+temperature+humidity+sensor+i2c' },
          { item: 'Magnetic Reed Switch (10-pack)', purpose: 'Door sensor (optional)', cost: '~$8', search: 'amazon.com/s?k=magnetic+reed+switch+sensor' },
          { item: '16GB microSD + micro-USB power supply', purpose: 'Storage and power', cost: '~$14', search: 'amazon.com/s?k=16gb+microsd+card' },
        ],
        software: ['w1thermsensor', 'adafruit-circuitpython-sht31d', 'requests'],
      },
    ];

    const commonHW = [
      { item: 'Jumper wires kit (F-F, M-F, M-M)', purpose: 'Breadboard wiring', cost: '~$7', search: 'amazon.com/s?k=jumper+wires+kit+breadboard' },
      { item: 'Mini breadboard', purpose: 'Prototype connections', cost: '~$5', search: 'amazon.com/s?k=mini+breadboard+electronics' },
      { item: 'Heat-shrink tubing kit', purpose: 'Insulate solder joints', cost: '~$8', search: 'amazon.com/s?k=heat+shrink+tubing+kit' },
      { item: 'Self-adhesive cable ties', purpose: 'Cable management', cost: '~$6', search: 'amazon.com/s?k=self+adhesive+cable+ties' },
    ];

    const border = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' };
    const cellBorders = { top: border, bottom: border, left: border, right: border };

    const headerRow = (cols: string[]) => new TableRow({
      children: cols.map(text => new TableCell({
        borders: cellBorders,
        shading: { type: ShadingType.SOLID, color: '4F46E5', fill: '4F46E5' },
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 22 })] })],
      })),
    });

    const dataRow = (cells: string[], shade = false) => new TableRow({
      children: cells.map(text => new TableCell({
        borders: cellBorders,
        shading: shade ? { type: ShadingType.SOLID, color: 'F9FAFB', fill: 'F9FAFB' } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
      })),
    });

    const children: (Paragraph | Table)[] = [
      new Paragraph({
        text: 'LabOS v2 — IoT Sensor Hardware & Software Guide',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, color: '6B7280', size: 20 })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' }),
    ];

    for (const section of sections) {
      children.push(
        new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: `Estimated cost: ${section.total}`, bold: true, color: '059669', size: 22 })] }),
        new Paragraph({ text: '' }),
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(['Item', 'Purpose', 'Cost', 'Amazon Search']),
            ...section.items.map((r, i) => dataRow([r.item, r.purpose, r.cost, r.search], i % 2 === 1)),
          ],
        }),
        new Paragraph({ text: '' }),
      );

      children.push(
        new Paragraph({ children: [new TextRun({ text: 'Software (pip install):', bold: true, size: 22 })] }),
        ...section.software.map(s => new Paragraph({ children: [new TextRun({ text: `• ${s}`, size: 20 })], indent: { left: 360 } })),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
      );
    }

    children.push(
      new Paragraph({ text: 'Common Hardware (all setups)', heading: HeadingLevel.HEADING_1 }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(['Item', 'Purpose', 'Cost', 'Amazon Search']),
          ...commonHW.map((r, i) => dataRow([r.item, r.purpose, r.cost, r.search], i % 2 === 1)),
        ],
      }),
      new Paragraph({ text: '' }),
      new Paragraph({ text: 'Raspberry Pi Setup Steps', heading: HeadingLevel.HEADING_1 }),
      ...[
        '1. Flash Raspberry Pi OS Lite to microSD using Raspberry Pi Imager',
        '2. Enable SSH and configure Wi-Fi in Raspberry Pi Imager settings',
        '3. SSH into Pi: ssh pi@<ip-address>',
        '4. Install Python deps: pip install requests adafruit-blinka (add sensor-specific libs)',
        '5. Copy pi_sensor.py and create pi_sensor.env with LABOS_URL, SENSOR_KEY, API_KEY, INTERVAL',
        '6. Test manually: python pi_sensor.py',
        '7. Enable systemd service for auto-start on boot (see pi_sensor.py comments)',
      ].map(s => new Paragraph({ children: [new TextRun({ text: s, size: 20 })], spacing: { after: 80 } })),
    );

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'LabOS_IoT_Hardware_Guide.docx');
  };

  const displayed = filterStatus === 'all' ? sensors : sensors.filter(s => s.status === filterStatus);
  const critCount = sensors.filter(s => s.status === 'critical').length;
  const warnCount = sensors.filter(s => s.status === 'warning').length;
  const unackAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>IoT Instrument Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            {usingRealApi ? '🟢 Live sensor data' : '🟡 Demo mode — no Pi sensors registered yet'} · Last refresh: {lastRefresh.toLocaleTimeString()}
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: usingRealApi ? '#4ade80' : '#fbbf24', marginLeft: 8, animation: 'pulse 2s infinite' }} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowRegister(v => !v)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--primary)', background: showRegister ? 'var(--primary)' : 'none', color: showRegister ? '#fff' : 'var(--primary)', cursor: 'pointer' }}>
            + Register Pi Sensor
          </button>
          <button onClick={() => setShowInstallGuide(true)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--primary)', background: 'rgba(99,102,241,0.08)', color: 'var(--primary)', cursor: 'pointer' }}>
            🛠️ View Install Guide
          </button>
          <button onClick={downloadHardwareGuide}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            📄 Download (.docx)
          </button>
          {critCount > 0 && (
            <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 700, fontSize: 13 }}>
              🚨 {critCount} Critical
            </div>
          )}
          {warnCount > 0 && (
            <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(234,179,8,0.15)', color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>
              ⚠️ {warnCount} Warning
            </div>
          )}
        </div>
      </div>

      {/* Register Sensor Panel */}
      {showRegister && <RegisterSensorPanel token={token} onCreated={() => { fetchRealSensors().then(ok => setUsingRealApi(ok)); setShowRegister(false); }} />}

      {showInstallGuide && (
        <InstallGuideModal
          sectionIdx={guideSectionIdx}
          setSectionIdx={setGuideSectionIdx}
          onClose={() => setShowInstallGuide(false)}
          onDownload={downloadHardwareGuide}
        />
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Devices Online', value: sensors.filter(s => s.status !== 'offline').length, color: '#4ade80', icon: '📡' },
          { label: 'Normal', value: sensors.filter(s => s.status === 'normal').length, color: '#4ade80', icon: '✅' },
          { label: 'Warnings', value: warnCount, color: '#fbbf24', icon: '⚠️' },
          { label: 'Critical', value: critCount, color: '#f87171', icon: '🚨' },
          { label: 'Unack. Alerts', value: unackAlerts, color: unackAlerts > 0 ? '#f87171' : '#9ca3af', icon: '🔔' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 20 }}>
        <div>
          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['all', 'normal', 'warning', 'critical', 'offline'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: filterStatus === s ? (s === 'all' ? 'var(--primary)' : STATUS_META[s as DeviceStatus]?.color || 'var(--primary)') : 'var(--border)', background: filterStatus === s ? (s === 'all' ? 'rgba(99,102,241,0.15)' : STATUS_META[s as DeviceStatus]?.bg || 'rgba(99,102,241,0.15)') : 'none', color: filterStatus === s ? (s === 'all' ? 'var(--primary)' : STATUS_META[s as DeviceStatus]?.color || 'var(--text)') : 'var(--text-muted)' }}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Sensor cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {displayed.map(sensor => {
              const sm = STATUS_META[sensor.status];
              const isSelected = selected?.id === sensor.id;
              const pct = Math.max(0, Math.min(100, ((sensor.current - sensor.min) / (sensor.max - sensor.min)) * 100));
              return (
                <div key={sensor.id} className="card"
                  onClick={() => {
                    const api = apiSensors.find(a => String(a.id) === sensor.id) ?? null;
                    setSelected(isSelected ? null : sensor);
                    setSelectedApiSensor(isSelected ? null : api);
                    setNotifyEmailDraft(api?.notify_email ?? '');
                  }}
                  style={{ cursor: 'pointer', borderColor: isSelected ? 'var(--primary)' : sm.color === '#f87171' ? 'rgba(239,68,68,0.4)' : 'var(--border)', background: isSelected ? 'rgba(99,102,241,0.05)' : undefined, transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: sm.dot, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{sensor.name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sensor.location}</div>
                    </div>
                    <span style={{ fontSize: 22 }}>{sensor.icon}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 32, fontWeight: 700, color: sm.color }}>{sensor.current}</span>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 4 }}>{sensor.unit}</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>
                      <div>Target: {sensor.target}{sensor.unit}</div>
                      <div>{sensor.min}–{sensor.max}{sensor.unit}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, marginBottom: 10 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: sm.color, borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>

                  {/* Sparkline */}
                  <Sparkline data={sensor.history} color={sm.color} min={sensor.min - 2} max={sensor.max + 2} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sm.bg, color: sm.color }}>{sm.label}</span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                      {sensor.battery !== undefined && <span>🔋 {sensor.battery}%</span>}
                      <span>{sensor.lastUpdated}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{selected.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.location}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>×</button>
              </div>

              <GaugeArc value={selected.current} min={selected.min} max={selected.max} color={STATUS_META[selected.status].color} />
              <div style={{ textAlign: 'center', marginTop: -8, marginBottom: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: STATUS_META[selected.status].color }}>{selected.current}</span>
                <span style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 4 }}>{selected.unit}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Target', value: `${selected.target} ${selected.unit}` },
                  { label: 'Safe Range', value: `${selected.min} – ${selected.max} ${selected.unit}` },
                  { label: 'Status', value: STATUS_META[selected.status].label },
                  { label: 'Battery', value: selected.battery !== undefined ? `${selected.battery}%` : 'N/A' },
                  { label: 'Last Updated', value: selected.lastUpdated },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontWeight: 500 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alert notification config */}
            <div className="card" style={{ marginBottom: 14 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>🔔 Alert Notifications</h4>
              {selectedApiSensor ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email recipients (comma-separated)</label>
                    <input
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                      value={notifyEmailDraft}
                      onChange={e => setNotifyEmailDraft(e.target.value)}
                      placeholder="pi@lab.local, manager@lab.local"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Cooldown: {selectedApiSensor.alert_cooldown_minutes} min between alerts</span>
                    <span>{selectedApiSensor.unack_alerts} unacknowledged</span>
                  </div>
                  <button onClick={saveNotifyEmail} disabled={savingThresholds}
                    style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {savingThresholds ? 'Saving…' : 'Save Email Config'}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                    Configure SMTP in backend .env to enable email delivery. Alerts also appear in the Active Alerts panel below.
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Connect a real Pi sensor to configure email alerts.</p>
              )}
            </div>

            {/* Historical log */}
            <div className="card">
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>24-Hour History</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selected.history.slice(-8).map((v, i) => {
                  const hr = 23 - (7 - i);
                  const isOk = v >= selected.min && v <= selected.max;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{String(hr).padStart(2, '0')}:00</span>
                      <span style={{ fontWeight: 600, color: isOk ? 'var(--text)' : '#f87171' }}>{v} {selected.unit}</span>
                      <span style={{ color: isOk ? '#4ade80' : '#f87171' }}>{isOk ? '✓' : '!'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Alerts — real when Pi is connected, mock otherwise */}
      {(usingRealApi ? realAlerts : alerts).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>
            Active Alerts
            {usingRealApi && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>from Pi sensors · auto-emailed when SMTP configured</span>}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {usingRealApi ? realAlerts.map(alert => {
              const isWarn = alert.severity === 'warning';
              return (
                <div key={alert.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, borderColor: isWarn ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)', background: isWarn ? 'rgba(234,179,8,0.04)' : 'rgba(239,68,68,0.04)', opacity: alert.acknowledged ? 0.55 : 1 }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{isWarn ? '⚠️' : '🚨'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{alert.sensor_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(alert.triggered_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{alert.message}</p>
                    {alert.notified_emails && <span style={{ fontSize: 11, color: '#60a5fa', marginTop: 4, display: 'block' }}>✉ Emailed: {alert.notified_emails}</span>}
                    {alert.acknowledged && <span style={{ fontSize: 11, color: '#4ade80', marginTop: 4, display: 'block' }}>✓ Acknowledged</span>}
                  </div>
                  {!alert.acknowledged && (
                    <button onClick={() => ackRealAlert(alert.id)} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                      Acknowledge
                    </button>
                  )}
                </div>
              );
            }) : alerts.map(alert => {
              const isWarn = alert.type === 'warning';
              return (
                <div key={alert.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, borderColor: isWarn ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)', background: isWarn ? 'rgba(234,179,8,0.04)' : 'rgba(239,68,68,0.04)', opacity: alert.acknowledged ? 0.55 : 1 }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{isWarn ? '⚠️' : '🚨'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{alert.sensorName}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{alert.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{alert.message}</p>
                    {alert.acknowledged && <span style={{ fontSize: 11, color: '#4ade80', marginTop: 4, display: 'block' }}>✓ Acknowledged</span>}
                  </div>
                  {!alert.acknowledged && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => ackAlert(alert.id)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Acknowledge</button>
                      <button onClick={() => dismissAlert(alert.id)} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 6, background: 'var(--danger, #ef4444)', cursor: 'pointer', color: '#fff' }}>Dismiss</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Install Guide Modal ─────────────────────────────────────────────────────
function InstallGuideModal({
  sectionIdx, setSectionIdx, onClose, onDownload,
}: {
  sectionIdx: number;
  setSectionIdx: (i: number) => void;
  onClose: () => void;
  onDownload: () => void;
}) {
  const sec = INSTALL_SECTIONS[sectionIdx];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: 980, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🛠️ Sensor Install Guide</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Pick a freezer / incubator type to see exactly what to buy and install
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDownload}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
              📄 Download .docx
            </button>
            <button onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text)', fontSize: 16 }}>
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2.4fr', minHeight: 0, flex: 1 }}>
          {/* Section list */}
          <div style={{ borderRight: '1px solid var(--border)', padding: 14, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Equipment Type
            </div>
            {INSTALL_SECTIONS.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setSectionIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  padding: '10px 12px', borderRadius: 8, marginBottom: 4, fontSize: 13,
                  border: '1px solid ' + (sectionIdx === i ? 'var(--primary)' : 'transparent'),
                  background: sectionIdx === i ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: 'var(--text)', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18 }}>{s.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.total}</div>
                </div>
              </button>
            ))}

            <div style={{ marginTop: 16, padding: 12, background: 'rgba(99,102,241,0.06)', borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>
              <strong>Quick start:</strong> The cheapest, most reliable starter is a
              <span style={{ display: 'inline-block', margin: '0 4px', padding: '0 6px', background: 'var(--surface2)', borderRadius: 4 }}>−20°C freezer</span>
              with a Raspberry Pi Zero + DS18B20. Total cost ~$50.
            </div>
          </div>

          {/* Section detail */}
          <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 26 }}>{sec.emoji}</span>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{sec.title}</h3>
              <span style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                {sec.total}
              </span>
            </div>
            {sec.notes && (
              <p style={{ margin: '4px 0 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                💡 {sec.notes}
              </p>
            )}

            {/* Parts table */}
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
              Parts list
            </h4>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {sec.items.map((it, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 2fr auto auto', gap: 12, alignItems: 'center',
                  padding: '10px 14px', borderBottom: i < sec.items.length - 1 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{it.item}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{it.purpose}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>{it.cost}</div>
                  <a href={`https://${it.search}`} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '4px 10px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Search Amazon ↗
                  </a>
                </div>
              ))}
            </div>

            {/* Software */}
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 8px', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
              Python packages (pip install)
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sec.software.map(s => (
                <code key={s} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  {s}
                </code>
              ))}
            </div>

            {/* Setup steps */}
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 8px', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
              Raspberry Pi setup
            </h4>
            <ol style={{ margin: 0, padding: '0 0 0 22px', fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
              {PI_SETUP_STEPS.map(step => <li key={step} style={{ marginBottom: 4 }}>{step}</li>)}
            </ol>

            <div style={{ marginTop: 18, padding: 12, background: 'rgba(234,179,8,0.08)', borderRadius: 8, fontSize: 12, lineHeight: 1.5, border: '1px solid rgba(234,179,8,0.2)' }}>
              <strong>⚠️ Safety reminder:</strong> Always test your sensor probe in a known-good environment
              (e.g. ice water at 0°C, room temp) before deploying. For LN₂ dewars, an O₂ depletion sensor is
              <em> mandatory</em> — never skip it.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
