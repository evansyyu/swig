# Firmware

Arduino sketches for the scale unit: 5 kg bar load cell → HX711 → Seeed Studio XIAO ESP32C3.

| Sketch | Use it for |
| --- | --- |
| `hx711_test/` | First wiring check. Press the load cell and watch the numbers change |
| `hx711_calibration/` | Find `CALIBRATION_FACTOR` with a known weight |
| `scale_firmware/` | The real firmware: sends weight to the server over WiFi |

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

1. Copy `secrets.h.example` to `secrets.h` and fill in the WiFi name, password, and server URL (local IP, or the `https://` Railway domain). `secrets.h` is gitignored. Never commit it.
2. Run `hx711_calibration`, then paste the `CALIBRATION_FACTOR` into `scale_firmware.ino`.
3. Power on with the platform **empty**, then upload.
4. The ESP32 only supports 2.4 GHz WiFi. On an iPhone hotspot, turn on **Maximize Compatibility**.

BOOT button (GPIO 9) re-zeros the scale. Don't hold it while powering on.
