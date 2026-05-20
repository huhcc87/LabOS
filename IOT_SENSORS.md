# LabOS IoT Instrument Dashboard — Sensor Reference

Complete hardware guide for every sensor type supported by the IoT dashboard.
All sensors report via MQTT or direct HTTP POST to `/api/iot/readings/{sensor_key}`.

---

## Supported Sensor Types

| Type | Dashboard Key | Typical Unit | Target Range |
|------|--------------|-------------|-------------|
| ULT Freezer | `freezer` | °C | −85 to −70 |
| −20°C Freezer | `freezer` | °C | −25 to −15 |
| CO₂ Incubator | `incubator` | °C | 36.5 to 37.5 |
| CO₂ Level | `co2` | % | 4.8 to 5.2 |
| Sample Fridge | `fridge` | °C | 2 to 8 |
| LN₂ Dewar Level | `ln2` | % | 20 to 100 |
| Humidity | `humidity` | %RH | 30 to 60 |

---

## 1. ULT Freezer (−80°C)

> Most critical sensor in the lab. Failure = irreplaceable sample loss.

**Hardware per unit — ~$100–$110**

| Component | Purpose | Cost | Search |
|-----------|---------|------|--------|
| Raspberry Pi 4 Model B (2 GB) | Gateway computer | ~$45 | `raspberry pi 4 2gb` |
| MAX31865 PT100/PT1000 RTD HAT | Read PT100 probe via SPI | ~$12 | `max31865 rtd hat raspberry pi` |
| PT100 Stainless Steel Probe (−200°C to +200°C) | Temperature measurement | ~$15 | `pt100 stainless steel probe temperature` |
| Magnetic Reed Switch (10-pack) | Door open/close detection | ~$8 | `magnetic reed switch sensor` |
| 32 GB microSD card | Pi OS storage | ~$8 | `32gb microsd card` |
| 5V 3A USB-C power supply | Power the Pi | ~$10 | `raspberry pi power supply usb-c 5v 3a` |
| Waterproof Cable Gland PG7 (10-pack) | Feed probe through freezer wall | ~$8 | `pg7 cable gland waterproof` |

**Wiring**
```
PT100 Probe → MAX31865 HAT → Raspberry Pi GPIO (SPI)
Reed Switch  → GPIO Pin 17 (pull-up, active LOW = door open)
```

**Python setup**
```bash
pip install adafruit-circuitpython-max31865 adafruit-blinka requests
# Enable SPI in raspi-config → Interfacing Options → SPI
```

**Thresholds**

| Status | Condition |
|--------|-----------|
| Normal | −85°C ≤ T ≤ −70°C |
| Warning | −70°C < T ≤ −65°C or door open > 2 min |
| Critical | T > −65°C or door open > 5 min |

---

## 2. −20°C Freezer

**Hardware per unit — ~$50–$60**

| Component | Purpose | Cost | Search |
|-----------|---------|------|--------|
| Raspberry Pi Zero 2 W | Compact gateway | ~$15 | `raspberry pi zero 2 w` |
| DS18B20 Waterproof Temperature Probe | Temp sensing (works to −55°C) | ~$10 | `ds18b20 waterproof temperature sensor` |
| 4.7 kΩ resistor | 1-Wire pull-up | ~$1 | `4.7k resistor` |
| Magnetic Reed Switch | Door sensor | ~$8 | `magnetic reed switch sensor` |
| 32 GB microSD | Storage | ~$8 | `32gb microsd card` |
| 5V 2.5A micro-USB power supply | Power | ~$10 | `raspberry pi zero power supply` |

**Python setup**
```bash
pip install w1thermsensor requests
# Enable 1-Wire: add dtoverlay=w1-gpio to /boot/config.txt, reboot
```

**Thresholds**

| Status | Condition |
|--------|-----------|
| Normal | −25°C ≤ T ≤ −15°C |
| Warning | −15°C < T ≤ −10°C |
| Critical | T > −10°C |

---

## 3. CO₂ Incubator (Temperature + CO₂%)

> Combine temperature and CO₂ in one sensor module.

**Hardware per unit — ~$90–$110**

| Component | Purpose | Cost | Search |
|-----------|---------|------|--------|
| Raspberry Pi 3B+ or 4 | Gateway | ~$35–$45 | `raspberry pi 3b+` |
| Sensirion SCD40 CO₂ Sensor (I²C) | CO₂ ppm + T/RH | ~$45 | `sensirion scd40 co2 sensor` |
| SHT31 Temperature + Humidity (I²C) | Backup temp probe | ~$12 | `sht31 temperature humidity sensor` |
| Stemma QT / Qwiic cable | Plug-and-play I²C wiring | ~$5 | `stemma qt cable` |
| 32 GB microSD | Storage | ~$8 | `32gb microsd card` |

**Python setup**
```bash
pip install adafruit-circuitpython-scd4x adafruit-circuitpython-sht31d adafruit-blinka requests
# Enable I²C: raspi-config → Interfacing Options → I2C
```

**Two readings per sensor key**
```
incubator-a-temp  → unit: °C,  target: 37,  min: 36.5, max: 37.5
incubator-a-co2   → unit: ppm, target: 5000, min: 4500, max: 5500
```

**Thresholds (Temperature)**

| Status | Condition |
|--------|-----------|
| Normal | 36.5°C ≤ T ≤ 37.5°C |
| Warning | 37.5°C < T ≤ 38°C or T < 36°C |
| Critical | T > 38°C or T < 35°C |

**Thresholds (CO₂)**

| Status | Condition |
|--------|-----------|
| Normal | 4.8% ≤ CO₂ ≤ 5.2% |
| Warning | 5.2% < CO₂ ≤ 5.5% or CO₂ < 4.5% |
| Critical | CO₂ > 6% or CO₂ < 4% |

---

## 4. LN₂ Dewar Level

> ⚠️ **Always pair with an O₂ depletion sensor for safety.** Liquid nitrogen displaces oxygen — monitor both.

**Hardware per unit — ~$140–$160**

| Component | Purpose | Cost | Search |
|-----------|---------|------|--------|
| Raspberry Pi 4 (2 GB) | Gateway | ~$45 | `raspberry pi 4 2gb` |
| Capacitance Liquid Level Sensor (DFRobot SEN0257) | LN₂ level 0–100% | ~$30 | `capacitance liquid level sensor dfrobot` |
| DFRobot Gravity O₂ Sensor | Safety — O₂% in room air | ~$25 | `oxygen sensor module o2 mq dfrobot` |
| ADS1115 16-bit ADC (I²C) | Read analog O₂ sensor on Pi | ~$8 | `ads1115 i2c adc raspberry pi` |
| MAX31865 + PT100 Probe | Cryo-temp of LN₂ surface | ~$27 | `max31865 rtd hat raspberry pi` |
| 32 GB microSD | Storage | ~$8 | `32gb microsd` |
| 5V 3A power supply | Power | ~$10 | `raspberry pi usb-c power supply` |

**Python setup**
```bash
pip install adafruit-circuitpython-ads1x15 adafruit-circuitpython-max31865 adafruit-blinka requests
```

**Three readings per unit**
```
ln2-tank-1-level  → unit: %,   target: 70, min: 20, max: 100
ln2-tank-1-temp   → unit: °C,  target: -196, min: -200, max: -150
ln2-tank-1-o2     → unit: %,   target: 20.9, min: 19.5, max: 22  ← SAFETY
```

**Thresholds (Level)**

| Status | Condition |
|--------|-----------|
| Normal | level ≥ 40% |
| Warning | 20% ≤ level < 40% — schedule refill |
| Critical | level < 20% — **refill immediately** |

**Thresholds (O₂ — safety)**

| Status | Condition |
|--------|-----------|
| Normal | 19.5% ≤ O₂ ≤ 22% |
| Warning | 18% ≤ O₂ < 19.5% — ventilate room |
| Critical | O₂ < 18% — **evacuate, call safety** |

---

## 5. Sample Fridge (+4°C)

**Hardware per unit — ~$50–$60**

| Component | Purpose | Cost | Search |
|-----------|---------|------|--------|
| Raspberry Pi Zero 2 W | Compact gateway | ~$15 | `raspberry pi zero 2 w` |
| DS18B20 Waterproof Probe | Temperature | ~$10 | `ds18b20 waterproof temperature sensor` |
| SHT31 Temperature + Humidity | Internal humidity (optional) | ~$12 | `sht31 temperature humidity sensor i2c` |
| Magnetic Reed Switch | Door open/close | ~$8 | `magnetic reed switch sensor` |
| 32 GB microSD | Storage | ~$8 | `32gb microsd card` |
| 5V 2.5A micro-USB power supply | Power | ~$10 | `raspberry pi zero power supply` |

**Thresholds**

| Status | Condition |
|--------|-----------|
| Normal | 2°C ≤ T ≤ 8°C |
| Warning | 8°C < T ≤ 10°C or T < 1°C |
| Critical | T > 10°C or T < 0°C |

---

## 6. Lab Ambient Humidity

**Hardware per unit — ~$30–$40**

| Component | Purpose | Cost | Search |
|-----------|---------|------|--------|
| Raspberry Pi Zero 2 W | Gateway | ~$15 | `raspberry pi zero 2 w` |
| DHT22 / AM2302 Temperature + Humidity | Ambient T/RH | ~$8 | `dht22 am2302 temperature humidity sensor` |
| 32 GB microSD | Storage | ~$8 | `32gb microsd` |
| 5V 2.5A power supply | Power | ~$10 | `raspberry pi zero power supply` |

**Python setup**
```bash
pip install adafruit-circuitpython-dht adafruit-blinka requests
```

**Thresholds**

| Status | Condition |
|--------|-----------|
| Normal | 30% ≤ RH ≤ 60% |
| Warning | 60% < RH ≤ 70% or RH < 25% |
| Critical | RH > 70% or RH < 20% |

---

## 7. Additional Sensors (Not Yet in Dashboard — Planned)

These can be added by extending `IoTSensorType` in `backend/app/models/models.py`.

| Sensor | Measures | Typical Use | Recommended Module |
|--------|---------|-------------|-------------------|
| **Water Leak** | Wet/dry detection | Under sinks, autoclave area, DI water line | DFRobot Gravity Water Sensor |
| **CO (Carbon Monoxide)** | ppm CO in air | Autoclave room, BSC exhaust | MQ-7 module + ADS1115 |
| **Pressure (autoclave)** | PSI / kPa | Autoclave cycle monitoring | Honeywell ABPMAND001PG2A5 |
| **pH (media prep)** | pH 0–14 | Media/buffer QC | Atlas Scientific EZO-pH circuit |
| **Conductivity** | μS/cm | DI water quality | Atlas Scientific EZO-EC circuit |
| **Airflow / Differential Pressure** | Pa | BSC face velocity, HEPA filter load | Sensirion SDP810 |
| **Vibration** | g-force | Centrifuge, shaker imbalance alert | ADXL345 3-axis accelerometer |
| **Power / UPS** | Watts, battery% | Critical equipment on UPS | Victron SmartShunt + VE.Direct |
| **Door access** | Reed switch count | Cold room, controlled-access | Magnetic Reed Switch (already used) |
| **Liquid nitrogen level (optical)** | mm depth | Large dewars | OPTi Liquid Level Sensor |

---

## Raspberry Pi Sensor Script Template

Save as `pi_sensor.py` on each Pi. Reads the sensor and POSTs to LabOS.

```python
#!/usr/bin/env python3
"""
LabOS Pi Sensor Agent
Reads a sensor and POSTs to /api/iot/readings/{sensor_key} every INTERVAL seconds.
Configure via environment variables or a .env file alongside this script.
"""
import os, time, requests
from dotenv import load_dotenv

load_dotenv("pi_sensor.env")

LABOS_URL   = os.environ["LABOS_URL"]       # e.g. https://labos-api.fly.dev
SENSOR_KEY  = os.environ["SENSOR_KEY"]      # e.g. freezer-ult-room204
API_KEY     = os.environ["API_KEY"]         # from LabOS → IoT Dashboard → Add Sensor
INTERVAL    = int(os.getenv("INTERVAL", "30"))  # seconds between readings

def read_sensor() -> float:
    """Replace with your actual sensor read code."""
    raise NotImplementedError("Implement sensor read here")

def post_reading(value: float):
    resp = requests.post(
        f"{LABOS_URL}/api/iot/readings/{SENSOR_KEY}",
        json={"value": value},
        headers={"X-API-Key": API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()

if __name__ == "__main__":
    print(f"[LabOS] Starting sensor agent for {SENSOR_KEY}")
    while True:
        try:
            val = read_sensor()
            result = post_reading(val)
            print(f"[LabOS] Posted {val} → status: {result.get('status')}")
        except Exception as e:
            print(f"[LabOS] Error: {e}")
        time.sleep(INTERVAL)
```

**`pi_sensor.env` (on the Pi, never commit this file)**
```env
LABOS_URL=https://labos-api.fly.dev
SENSOR_KEY=freezer-ult-room204
API_KEY=your-sensor-api-key-from-labos-dashboard
INTERVAL=30
```

**Run as a systemd service (auto-start on boot)**
```ini
# /etc/systemd/system/labos-sensor.service
[Unit]
Description=LabOS Sensor Agent
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/pi_sensor.py
WorkingDirectory=/home/pi
Restart=always
RestartSec=10
User=pi

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable labos-sensor
sudo systemctl start labos-sensor
sudo journalctl -u labos-sensor -f   # tail logs
```

---

## MQTT Alternative (no polling)

If you run a local MQTT broker (e.g. Mosquitto on a NAS), sensors can publish directly
and LabOS relays via the MQTT thread (set `MQTT_BROKER_HOST` in `.env`).

```bash
# Publish from Pi
mosquitto_pub -h 192.168.1.100 -t "lab/sensors/freezer-ult-room204" \
  -m '{"sensor_key":"freezer-ult-room204","value":-79.3}'
```

```env
# backend/.env — enable relay
MQTT_BROKER_HOST=192.168.1.100
MQTT_BROKER_PORT=1883
MQTT_TOPIC=lab/sensors/#
```

---

## Total Estimated Lab Setup Cost

| Equipment Count | Estimated Cost |
|----------------|---------------|
| 1× ULT freezer | ~$110 |
| 1× −20°C freezer | ~$55 |
| 1× CO₂ incubator | ~$100 |
| 1× LN₂ dewar | ~$155 |
| 1× Sample fridge | ~$55 |
| 1× Humidity node | ~$35 |
| **Full 6-sensor lab** | **~$510 total** |

All components are available on Amazon, Adafruit, or DigiKey.
No proprietary hardware or subscription required.
