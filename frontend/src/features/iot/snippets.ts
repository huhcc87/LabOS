/** Code a lab member pastes onto the device. The sensor key and address are filled in. */
import type { CodeKind } from './presets';

export const siteUrl = (): string => {
  const cloud = (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? '';
  return cloud.replace('.convex.cloud', '.convex.site');
};

export type Platform = 'esp32' | 'pi' | 'curl';

const K = (key?: string) => key ?? 'PASTE_YOUR_SENSOR_KEY_HERE';

export function curlTest(key?: string, value = -80.1): string {
  return `curl -X POST ${siteUrl()}/iot/reading \\
  -H "Authorization: Bearer ${K(key)}" \\
  -H "Content-Type: application/json" \\
  -d '{"value": ${value}}'
# Expected answer: {"ok":true}`;
}

const READ_ESP: Record<CodeKind, { includes: string; globals: string; setup: string; read: string }> = {
  ds18b20: {
    includes: `#include <OneWire.h>\n#include <DallasTemperature.h>`,
    globals: `OneWire oneWire(4);               // data wire on GPIO4\nDallasTemperature probe(&oneWire);`,
    setup: `  probe.begin();`,
    read: `  probe.requestTemperatures();
  float v = probe.getTempCByIndex(0);
  if (v == DEVICE_DISCONNECTED_C || v < -60) return NAN;   // probe unplugged or broken
  return v;`,
  },
  pt100: {
    includes: `#include <Adafruit_MAX31865.h>`,
    globals: `Adafruit_MAX31865 rtd(5, 23, 19, 18);   // CS, MOSI, MISO, CLK
const float RREF = 430.0, RNOMINAL = 100.0;   // PT100 board values`,
    setup: `  rtd.begin(MAX31865_3WIRE);              // use MAX31865_2WIRE if your probe has 2 wires`,
    read: `  if (rtd.readFault()) { rtd.clearFault(); return NAN; }   // open probe, short, etc.
  return rtd.temperature(RNOMINAL, RREF);`,
  },
  generic: {
    includes: `// Add the library for your sensor here`,
    globals: ``,
    setup: `  // Start your sensor here`,
    read: `  // Return the number you want to track (temperature, %, ppm...).
  // Example for a 4-20 mA level probe on an ADS1115 (150 ohm shunt):
  //   float volts = ads.computeVolts(ads.readADC_SingleEnded(0));
  //   float mA = volts / 0.150 * 1000.0;
  //   return constrain((mA - 4.0) / 16.0 * 100.0, 0, 100);   // % full
  return NAN;`,
  },
};

export function esp32Code(kind: CodeKind, key?: string): string {
  const r = READ_ESP[kind];
  return `// LabOS sensor — ESP32 (Arduino IDE / PlatformIO)
// Libraries: ${kind === 'ds18b20' ? 'OneWire, DallasTemperature' : kind === 'pt100' ? 'Adafruit MAX31865' : 'the one for your sensor'}
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
${r.includes}

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* URL = "${siteUrl()}/iot/reading";
const char* KEY = "${K(key)}";          // keep this private
const unsigned long EVERY_MS = 30000;      // one reading every 30 seconds
${r.globals}

float readSensor() {
${r.read}
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) delay(250);
}

void setup() {
  Serial.begin(115200);
${r.setup}
  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  float v = readSensor();
  if (isnan(v)) {
    Serial.println("Sensor read failed — nothing sent");   // LabOS raises an offline alert if this goes on
  } else if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();   // skips certificate checks. For a stricter setup load the server's CA with client.setCACert()
    HTTPClient http;
    http.begin(client, URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + KEY);
    int code = http.POST(String("{\\"value\\": ") + String(v, 2) + "}");
    Serial.printf("%.2f -> HTTP %d\\n", v, code);   // 200 = stored
    http.end();
  }
  delay(EVERY_MS);
}
`;
}

const READ_PI: Record<CodeKind, { imports: string; read: string }> = {
  ds18b20: {
    imports: `from w1thermsensor import W1ThermSensor\nprobe = W1ThermSensor()`,
    read: `    return probe.get_temperature()`,
  },
  pt100: {
    imports: `import board, busio, digitalio, adafruit_max31865\nspi = busio.SPI(board.SCK, MOSI=board.MOSI, MISO=board.MISO)\nrtd = adafruit_max31865.MAX31865(spi, digitalio.DigitalInOut(board.CE0), wires=3)`,
    read: `    return rtd.temperature`,
  },
  generic: { imports: `# import the library for your sensor`, read: `    raise NotImplementedError("return the number you want to track")` },
};

export function piCode(kind: CodeKind, key?: string): string {
  const r = READ_PI[kind];
  return `#!/usr/bin/env python3
# LabOS sensor — Raspberry Pi.  pip install requests ${kind === 'ds18b20' ? 'w1thermsensor' : kind === 'pt100' ? 'adafruit-circuitpython-max31865' : ''}
import time, requests
${r.imports}

URL = "${siteUrl()}/iot/reading"
KEY = "${K(key)}"      # keep this private
EVERY = 30             # seconds

def read_sensor():
${r.read}

while True:
    try:
        value = round(read_sensor(), 2)
        res = requests.post(URL, json={"value": value}, headers={"Authorization": f"Bearer {KEY}"}, timeout=10)
        print(value, res.status_code)          # 200 = stored
    except Exception as e:
        print("failed:", e)                     # LabOS raises an offline alert if this goes on
    time.sleep(EVERY)
`;
}

export const PI_SERVICE = `# /etc/systemd/system/labos-sensor.service  (starts at boot, restarts if it crashes)
[Unit]
Description=LabOS sensor
After=network-online.target
Wants=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/labos-sensor
ExecStart=/usr/bin/python3 /home/pi/labos-sensor/sensor.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
# then:  sudo systemctl enable --now labos-sensor`;
