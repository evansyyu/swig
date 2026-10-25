# Firmware

Arduino sketches for the scale unit: 5 kg bar load cell → HX711 → Seeed Studio XIAO ESP32C3.

| Sketch | Use it for |
| --- | --- |
| `hx711_test/` | First wiring check. Press the load cell and watch the numbers change |
| `hx711_calibration/` | Standalone calibration check (the real firmware calibrates itself) |
| `scale_firmware/` | The real firmware: notifies the weight over BLE; the phone app relays it to the server |

## Wiring

| HX711 | XIAO ESP32C3 |
| --- | --- |
| VCC | 3V3 (not 5V) |
| GND | GND |
| DT | D2 (GPIO 4) |
| SCK | D3 (GPIO 5) |

| Load cell wire | HX711 pad |
| --- | --- |
| Red | E+ |
| Black | E- |
| White | A- |
| Green | A+ |

Wire colors vary. If the reading goes down when you press, swap white and green.

## Arduino IDE setup

1. Preferences → Additional boards manager URLs: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
2. Boards Manager: install **esp32** (Espressif Systems).
3. Library Manager: install **HX711 Arduino Library** (by bogde).
4. Board: **XIAO_ESP32C3**. Tools → **USB CDC On Boot: Enabled**.
5. No port? Hold BOOT while plugging in USB, and use a data cable.

## Using `scale_firmware`

1. Upload with the platform **empty** (it tares at boot, about 3 seconds after power-up). No WiFi
   or secrets needed. Each tare is saved, so a cup left on at a later power-up keeps the saved zero
   instead of becoming the new one.
2. Calibrate once: in the app, Settings → Calibrate, or over Serial Monitor (115200 baud) with `c`.
   Use something with a known weight. The factor is saved in flash and survives power cycles.
   An uncalibrated scale waits at the calibration prompt and sends no weight until calibrated.
3. The scale advertises as `SWIG-SCALE`. The app finds and connects to it by itself
   (BLE details in [`docs/API.md`](../docs/API.md#the-scale-ble)).

The scale sends a reading about twice a second and re-zeros itself after about 3 seconds
nearly empty (under 12 g) and steady (within 1 g), which also pulls slight negative drift back to 0.
Calibration waits up to about 15 seconds for the known weight to settle and cancels if it doesn't. BOOT button (GPIO 9) or Serial `t` re-zeros it by hand. Don't hold
BOOT while powering on.
