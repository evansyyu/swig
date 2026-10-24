#include "HX711.h"

HX711 scale;

void setup() {
  Serial.begin(115200);
  delay(1000);

  scale.begin(4, 5);   // DT = GPIO 4 (D2), SCK = GPIO 5 (D3)

  Serial.println("Waiting for HX711...");
  while (!scale.is_ready()) {
    Serial.println("HX711 not found. Check wiring.");
    delay(1000);
  }

  scale.set_scale(1.0);
  scale.tare();        // treat the current state as zero
  Serial.println("Tared. Now press the load cell.");
}

void loop() {
  if (scale.is_ready()) {
    long raw = scale.read();
    float change = scale.get_units(5);
    Serial.print("raw: ");
    Serial.print(raw);
    Serial.print("   change: ");
    Serial.println(change);
  }
  delay(300);
}
