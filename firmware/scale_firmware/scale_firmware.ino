// WaterAlarmi scale firmware (Seeed Studio XIAO ESP32C3 + HX711 + 5 kg load cell)
//
// Reads the weight about twice a second and POSTs {"grams": ...} to the server
// (see docs/API.md). Re-zeros itself when the platform stays empty, and when
// the BOOT button is pressed.
//
// Setup: copy secrets.h.example to secrets.h and fill it in.

#include <WiFi.h>
#include <HTTPClient.h>
#include "HX711.h"
#include "secrets.h"

// ---- Pins (XIAO ESP32C3) ----
const int DT_PIN   = 4;   // D2
const int SCK_PIN  = 5;   // D3
const int TARE_PIN = 9;   // BOOT button, pressed = LOW

// ---- Calibration: run firmware/hx711_calibration and paste the value here ----
float CALIBRATION_FACTOR = 1.0;

// ---- Auto tare ----
const float EMPTY_THRESHOLD_G = 12.0;  // below this the platform counts as empty
const int   EMPTY_READINGS    = 6;     // about 3 seconds of empty before re-zeroing

HX711 scale;
int emptyCount = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected: " + WiFi.localIP().toString());
}

void sendWeight(float grams) {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    return;
  }
  HTTPClient http;
  http.setTimeout(2000);
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST("{\"grams\":" + String(grams, 1) + "}");
  if (code != 200) {
    Serial.println("POST failed: " + String(code));
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(TARE_PIN, INPUT_PULLUP);

  scale.begin(DT_PIN, SCK_PIN);
  while (!scale.is_ready()) {
    Serial.println("HX711 not found. Check wiring.");
    delay(1000);
  }
  scale.set_scale(CALIBRATION_FACTOR);
  Serial.println("Keep the platform EMPTY. Taring...");
  delay(1000);
  scale.tare(10);

  connectWiFi();
}

void loop() {
  // Manual tare: press the BOOT button (only after boot has finished)
  if (digitalRead(TARE_PIN) == LOW) {
    delay(50);
    if (digitalRead(TARE_PIN) == LOW) {
      scale.tare(10);
      emptyCount = 0;
      Serial.println("Tared (button)");
      while (digitalRead(TARE_PIN) == LOW) delay(10);
    }
  }

  if (scale.is_ready()) {
    float grams = scale.get_units(5);  // average of 5 readings
    Serial.println(grams, 1);

    // Auto tare: platform empty for about 3 seconds -> re-zero
    if (fabs(grams) < EMPTY_THRESHOLD_G) {
      if (++emptyCount >= EMPTY_READINGS) {
        scale.tare(10);
        emptyCount = 0;
        Serial.println("Tared (auto)");
      }
    } else {
      emptyCount = 0;
    }

    sendWeight(grams);
  }
  delay(200);
}
