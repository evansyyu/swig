#include "HX711.h"

HX711 scale;
float factor = 1.0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  scale.begin(4, 5);   // DT = GPIO 4 (D2), SCK = GPIO 5 (D3)

  while (!scale.is_ready()) {
    Serial.println("HX711 not found. Check wiring.");
    delay(1000);
  }

  scale.set_scale(1.0);
  Serial.println("Keep the platform EMPTY. Taring in 3 seconds...");
  delay(3000);
  scale.tare(20);
  Serial.println("Tared.");
  Serial.println("Place a known weight, then type its weight in grams (e.g. 500) and press Enter.");
}

void loop() {
  if (Serial.available()) {
    float known = Serial.parseFloat();
    while (Serial.available()) Serial.read();   // clear the rest of the line

    if (known > 0) {
      float avg = scale.get_units(20);          // average of 20 readings
      factor = avg / known;
      scale.set_scale(factor);

      Serial.print("CALIBRATION_FACTOR = ");
      Serial.println(factor, 4);
      Serial.println("Now showing grams. Check with a different known weight.");
    }
  }

  if (factor != 1.0 && scale.is_ready()) {
    Serial.print("grams: ");
    Serial.println(scale.get_units(5), 1);
    delay(300);
  }
}
