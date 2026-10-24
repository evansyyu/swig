#include "HX711.h"
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>

BLECharacteristic* ch;

const int DT_PIN   = 4;   // D2 on XIAO
const int SCK_PIN  = 5;   // D3 on XIAO
const int TARE_BTN = 9;   // BOOT button

HX711 scale;
Preferences prefs;
float calFactor = 0;

String waitForLine() {
  while (!Serial.available()) delay(10);
  String s = Serial.readStringUntil('\n');
  s.trim();
  return s;
}

void calibrate() {
  Serial.println("\n--- CALIBRATION ---");
  Serial.println("Remove everything from the scale, then press Enter.");
  waitForLine();
  scale.set_scale();        // reset to raw units
  scale.tare(20);
  Serial.println("Tared. Place a KNOWN weight on the scale.");
  Serial.println("Type its weight in grams (e.g. 500) and press Enter:");
  float known = waitForLine().toFloat();
  if (known <= 0) {
    Serial.println("Invalid weight, calibration cancelled.");
    if (calFactor != 0) scale.set_scale(calFactor);
    return;
  }
  delay(1000);              // let it settle
  long reading = scale.get_value(20);
  calFactor = reading / known;
  scale.set_scale(calFactor);
  prefs.putFloat("cal", calFactor);
  Serial.printf("Calibration factor: %.4f (saved)\n", calFactor);
  Serial.println("Remove the weight. Done!\n");
}

// Restarts advertising after a disconnect so the phone can reconnect
class MyServerCallbacks : public BLEServerCallbacks {
  void onDisconnect(BLEServer* s) override {
    s->getAdvertising()->start();
  }
};

void setup() {
  Serial.begin(115200);
  BLEDevice::init("SWIG-SCALE");
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new MyServerCallbacks());

  BLEService* service = server->createService("12345678-1234-1234-1234-1234567890ab");
  ch = service->createCharacteristic(
         "abcd1234-5678-90ab-cdef-1234567890ab",
         BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  ch->addDescriptor(new BLE2902());
  service->start();
  server->getAdvertising()->start();
  Serial.println("BLE ready. Look for 'ESP32-Sensor'.");

  //SETUP SCALE:
  unsigned long start = millis();
  while (!Serial && millis() - start < 3000) delay(10);
  Serial.setTimeout(100000);

  pinMode(TARE_BTN, INPUT_PULLUP);
  prefs.begin("scale", false);
  calFactor = prefs.getFloat("cal", 0);

  scale.begin(DT_PIN, SCK_PIN);
  Serial.println("Waiting for HX711...");
  while (!scale.is_ready()) delay(100);

  scale.tare(20);
  if (calFactor == 0) {
    Serial.println("Not calibrated yet.");
    calibrate();
  } else {
    scale.set_scale(calFactor);
    Serial.printf("Loaded calibration factor: %.4f\n", calFactor);
  }
  Serial.println("Commands: 't' = tare, 'c' = recalibrate");
}

void loop() {
    float grams = -1;
    if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "t") { scale.tare(20); Serial.println("Tared."); }
    else if (cmd == "c") calibrate();
  }

  // BOOT button tare
  static unsigned long lastPress = 0;
  if (digitalRead(TARE_BTN) == LOW && millis() - lastPress > 500) {
    lastPress = millis();
    scale.tare(20);
    Serial.println("Tared (button).");
  }

  // Print weight
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 250 && scale.is_ready()) {
    lastPrint = millis();
    grams = scale.get_units(5);
    if (fabs(grams) < 0.5) grams = 0;   // hide tiny noise around zero
    Serial.printf("Weight: %.1f g\n", grams);
  }

  //SEND
  String Sgram = String(grams);
  ch->setValue(Sgram);           
  ch->notify();
  Serial.println(Sgram);
  delay(1000);
}