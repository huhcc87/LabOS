/** Ready-made sensor setups (limits follow the lab's IOT_SENSORS.md) and how a sensor's state is judged. */

export type CodeKind = 'ds18b20' | 'pt100' | 'generic';

export interface Preset {
  id: string;
  label: string;
  sensor_type: string;
  unit: string;
  min_threshold?: number;
  max_threshold?: number;
  critical_min?: number;
  critical_max?: number;
  offline_after_min: number;
  code: CodeKind;
  /** What to buy and how to wire it. */
  hardware: string[];
  wiring: string[];
  note?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'ult80', label: '−80 °C freezer (ULT)', sensor_type: 'freezer', unit: '°C',
    max_threshold: -70, critical_max: -65, offline_after_min: 10, code: 'pt100',
    hardware: ['ESP32 dev board (or Raspberry Pi 4)', 'MAX31865 PT100 amplifier board', 'PT100 probe, 3-wire (rated −200 to +200 °C)', 'Cable gland / door-seal feed-through for the probe', '5 V USB power supply (put it on a UPS if you can)'],
    wiring: ['Probe wires → MAX31865 terminals (3-wire: the two same-colour wires on one side)', 'MAX31865 → ESP32: VIN→3V3, GND→GND, CLK→GPIO18, SDO→GPIO19, SDI→GPIO23, CS→GPIO5', 'Run the probe through the door gasket or a vent port and tape it in the middle of the box area, not touching walls'],
    note: 'A ULT freezer rises slowly. 10 minutes without a reading raises an offline alert.',
  },
  {
    id: 'f20', label: '−20 °C freezer', sensor_type: 'freezer', unit: '°C',
    max_threshold: -15, critical_max: -10, offline_after_min: 10, code: 'ds18b20',
    hardware: ['ESP32 dev board (or Raspberry Pi Zero 2 W)', 'DS18B20 waterproof probe (works to −55 °C)', '4.7 kΩ resistor', '5 V USB power supply'],
    wiring: ['DS18B20 red→3V3, black→GND, yellow/white (data)→GPIO4', '4.7 kΩ resistor between data and 3V3', 'Feed the probe through the door gasket; the thin cable survives the seal'],
  },
  {
    id: 'ln2temp', label: 'Liquid nitrogen tank — temperature', sensor_type: 'freezer', unit: '°C',
    min_threshold: -200, max_threshold: -150, critical_max: -120, offline_after_min: 10, code: 'pt100',
    hardware: ['ESP32 dev board', 'MAX31865 PT100 amplifier board', 'PT100 probe rated for cryogenic use (−200 °C)', '5 V USB power supply'],
    wiring: ['Same wiring as the −80 °C freezer', 'Fix the probe in the neck of the tank, above the liquid line, with a cryo-safe clip'],
    note: 'Temperature climbing toward −150 °C in the neck means the level is low or the lid is open.',
  },
  {
    id: 'ln2level', label: 'Liquid nitrogen tank — level', sensor_type: 'ln2_level', unit: '%',
    min_threshold: 40, critical_min: 20, offline_after_min: 15, code: 'generic',
    hardware: ['LN₂ level probe with a 4–20 mA output (sold for dewars)', 'ADS1115 16-bit ADC', '150 Ω precision resistor (shunt)', 'ESP32 dev board'],
    wiring: ['Probe loop → 150 Ω resistor → GND; the voltage across the resistor → ADS1115 A0', 'ADS1115 → ESP32 I²C: SDA→GPIO21, SCL→GPIO22, VDD→3V3, GND→GND', '4 mA = empty, 20 mA = full; calibrate with your own tank (see the code comments)'],
    note: 'Level probes differ by maker: check your probe\'s datasheet for the output range before trusting the percentage.',
  },
  {
    id: 'o2', label: 'Oxygen (room safety near LN₂)', sensor_type: 'oxygen', unit: '%',
    min_threshold: 19.5, max_threshold: 22, critical_min: 18, offline_after_min: 10, code: 'generic',
    hardware: ['I²C oxygen sensor module (e.g. DFRobot Gravity O₂)', 'ESP32 dev board', '5 V USB power supply'],
    wiring: ['Sensor → ESP32 I²C: SDA→GPIO21, SCL→GPIO22, VCC→3V3, GND→GND', 'Mount at head height, 1–2 m from the tank, away from the door'],
    note: 'Liquid nitrogen displaces oxygen. Below 18 % leave the room and call safety. Do not rely on this alone: use a certified alarm too.',
  },
  {
    id: 'fridge', label: 'Fridge (+4 °C)', sensor_type: 'fridge', unit: '°C',
    min_threshold: 2, max_threshold: 8, critical_min: 0, critical_max: 10, offline_after_min: 10, code: 'ds18b20',
    hardware: ['ESP32 dev board', 'DS18B20 waterproof probe', '4.7 kΩ resistor', '5 V USB power supply'],
    wiring: ['Same wiring as the −20 °C freezer'],
  },
  {
    id: 'incubator', label: 'CO₂ incubator — temperature', sensor_type: 'incubator', unit: '°C',
    min_threshold: 36.5, max_threshold: 37.5, critical_min: 35, critical_max: 38, offline_after_min: 10, code: 'ds18b20',
    hardware: ['ESP32 dev board', 'DS18B20 waterproof probe', '4.7 kΩ resistor'],
    wiring: ['Same wiring as the −20 °C freezer', 'Put the probe on a shelf in a vial of water so it tracks the sample temperature'],
  },
  {
    id: 'co2', label: 'CO₂ incubator — CO₂ %', sensor_type: 'co2', unit: '%',
    min_threshold: 4.8, max_threshold: 5.2, critical_min: 4, critical_max: 6, offline_after_min: 10, code: 'generic',
    hardware: ['Sensirion SCD40 CO₂ sensor (I²C)', 'ESP32 dev board'],
    wiring: ['SCD40 → ESP32 I²C: SDA→GPIO21, SCL→GPIO22, VDD→3V3, GND→GND', 'The SCD40 reports ppm: divide by 10 000 to get %'],
  },
  {
    id: 'humidity', label: 'Room humidity', sensor_type: 'humidity', unit: '%RH',
    min_threshold: 30, max_threshold: 60, critical_min: 20, critical_max: 80, offline_after_min: 15, code: 'generic',
    hardware: ['SHT31 temperature + humidity sensor (I²C)', 'ESP32 dev board'],
    wiring: ['SHT31 → ESP32 I²C: SDA→GPIO21, SCL→GPIO22, VIN→3V3, GND→GND'],
  },
  {
    id: 'custom', label: 'Something else', sensor_type: 'custom', unit: '',
    offline_after_min: 15, code: 'generic',
    hardware: ['Any device that can read a number and make an HTTPS request'], wiring: ['Send the number to the endpoint shown after you save the sensor'],
  },
];

export const presetById = (id?: string) => PRESETS.find((p) => p.id === id);

export type SensorState = 'nodata' | 'offline' | 'critical' | 'warning' | 'ok' | 'off';

interface Judged {
  is_active: boolean; last_reading?: number; last_reading_at?: number; offline_after_min?: number;
  min_threshold?: number; max_threshold?: number; critical_min?: number; critical_max?: number;
}

/** Offline beats everything else: a stale number can't be trusted. */
export function sensorState(s: Judged, now = Date.now()): SensorState {
  if (!s.is_active) return 'off';
  if (s.last_reading === undefined || s.last_reading_at === undefined) return 'nodata';
  if (now - s.last_reading_at > (s.offline_after_min ?? 15) * 60_000) return 'offline';
  const v = s.last_reading;
  if ((s.critical_max !== undefined && v > s.critical_max) || (s.critical_min !== undefined && v < s.critical_min)) return 'critical';
  if ((s.max_threshold !== undefined && v > s.max_threshold) || (s.min_threshold !== undefined && v < s.min_threshold)) return 'warning';
  return 'ok';
}

export const STATE_LABEL: Record<SensorState, string> = {
  ok: 'Normal', warning: 'Warning', critical: 'Critical', offline: 'Offline', nodata: 'Waiting for data', off: 'Switched off',
};
export const STATE_STYLE: Record<SensorState, { bg: string; fg: string }> = {
  ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-text)' },
  warning: { bg: 'var(--warn-bg)', fg: 'var(--warn-text)' },
  critical: { bg: 'var(--bad-bg)', fg: 'var(--bad-text)' },
  offline: { bg: 'var(--bad-bg)', fg: 'var(--bad-text)' },
  nodata: { bg: 'var(--neutral-bg)', fg: 'var(--neutral-text)' },
  off: { bg: 'var(--neutral-bg)', fg: 'var(--neutral-text)' },
};

export function ago(ms?: number, now = Date.now()): string {
  if (!ms) return 'never';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
