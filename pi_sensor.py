#!/usr/bin/env python3
"""
Raspberry Pi sensor poster for LabOS v2
────────────────────────────────────────
Hardware: Raspberry Pi (any model) + MAX31865 PT100 RTD HAT

Wiring (MAX31865 SPI HAT — typical pin-out):
  HAT VIN  → Pi 3.3V  (pin 1)
  HAT GND  → Pi GND   (pin 6)
  HAT CLK  → Pi SCLK  (GPIO 11 / pin 23)
  HAT SDO  → Pi MISO  (GPIO 9  / pin 21)
  HAT SDI  → Pi MOSI  (GPIO 10 / pin 19)
  HAT CS   → Pi CE0   (GPIO 8  / pin 24)
  PT100 probe wired to HAT's 2-wire or 3-wire terminals

Install dependencies on the Pi:
  sudo apt-get install -y python3-pip python3-venv
  python3 -m venv venv && source venv/bin/activate
  pip install adafruit-circuitpython-max31865 requests python-dotenv

Configuration — create pi_sensor.env next to this file:
  LABOS_URL=http://192.168.1.100:8000    # IP of the machine running LabOS
  SENSOR_KEY=pi-room204-ult1             # must match what you registered in LabOS
  API_KEY=<paste key from LabOS>         # shown once when you register the sensor
  INTERVAL=30                            # seconds between readings (default 30)

Run:
  source venv/bin/activate
  python3 pi_sensor.py

Auto-start on boot (systemd):
  See pi_sensor.service at the bottom of this file.
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

# ─── Load config ──────────────────────────────────────────────────────────────
load_dotenv("pi_sensor.env")

LABOS_URL  = os.environ.get("LABOS_URL",  "http://localhost:8000").rstrip("/")
SENSOR_KEY = os.environ.get("SENSOR_KEY", "")
API_KEY    = os.environ.get("API_KEY",    "")
INTERVAL   = int(os.environ.get("INTERVAL", "30"))
DRY_RUN    = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")

if not SENSOR_KEY or not API_KEY:
    sys.exit("ERROR: Set SENSOR_KEY and API_KEY in pi_sensor.env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("pi_sensor")

# ─── Read PT100 via MAX31865 ───────────────────────────────────────────────────
def read_temperature_celsius() -> float:
    """
    Returns the PT100 temperature in °C.
    Requires adafruit-circuitpython-max31865 and SPI enabled on the Pi.

    To enable SPI:  sudo raspi-config → Interfacing Options → SPI → Enable
    """
    try:
        import board          # type: ignore
        import busio          # type: ignore
        import digitalio      # type: ignore
        import adafruit_max31865  # type: ignore

        spi = busio.SPI(board.SCK, MOSI=board.MOSI, MISO=board.MISO)
        cs  = digitalio.DigitalInOut(board.CE0)
        sensor = adafruit_max31865.MAX31865(spi, cs, wires=2)
        return round(sensor.temperature, 2)
    except Exception as exc:
        raise RuntimeError(f"MAX31865 read failed: {exc}") from exc


def simulate_temperature() -> float:
    """Fake reading for testing without hardware (DRY_RUN=true)."""
    import math, random
    t = time.time()
    return round(-79.5 + math.sin(t / 60) * 0.8 + random.uniform(-0.2, 0.2), 2)


# ─── Post reading to LabOS ────────────────────────────────────────────────────
def post_reading(value: float) -> bool:
    url = f"{LABOS_URL}/api/iot/readings/{SENSOR_KEY}"
    payload = {
        "value": value,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"X-API-Key": API_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except requests.RequestException as exc:
        log.warning("POST failed: %s", exc)
        return False


# ─── Main loop ────────────────────────────────────────────────────────────────
def main():
    log.info("Starting LabOS Pi sensor — key=%s  interval=%ds  dry_run=%s", SENSOR_KEY, INTERVAL, DRY_RUN)
    consecutive_failures = 0

    while True:
        try:
            value = simulate_temperature() if DRY_RUN else read_temperature_celsius()
            log.info("Reading: %.2f°C", value)

            ok = post_reading(value)
            if ok:
                log.info("Posted OK → %s", LABOS_URL)
                consecutive_failures = 0
            else:
                consecutive_failures += 1
                if consecutive_failures >= 5:
                    log.error("5 consecutive POST failures — check network / server")
                    consecutive_failures = 0  # reset so we don't spam logs

        except RuntimeError as exc:
            log.error("Sensor read error: %s", exc)

        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()


# ─── Systemd service (save as /etc/systemd/system/pi_sensor.service) ──────────
# [Unit]
# Description=LabOS Pi Sensor
# After=network-online.target
# Wants=network-online.target
#
# [Service]
# Type=simple
# User=pi
# WorkingDirectory=/home/pi/pi_sensor
# ExecStart=/home/pi/pi_sensor/venv/bin/python3 pi_sensor.py
# Restart=always
# RestartSec=10
#
# [Install]
# WantedBy=multi-user.target
#
# Enable:
#   sudo systemctl daemon-reload
#   sudo systemctl enable pi_sensor
#   sudo systemctl start pi_sensor
#   sudo journalctl -u pi_sensor -f   # live logs
