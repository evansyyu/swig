// Swig scale firmware (Seeed Studio XIAO ESP32C3 + HX711 + 5 kg load cell)
//
// Advertises as SWIG-SCALE over BLE and notifies the weight about twice a second.
// The phone app relays each reading to the server's POST /weight (see docs/API.md).

#include "HX711.h"
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>

#define SERVICE_UUID "12345678-1234-1234-1234-1234567890ab"

BLECharacteristic* ch;        // weight, notified as a string ("123.45")
BLECharacteristic* statusCh;  // calibration step, read by the app on connect + notified

const int DT_PIN   = 4;   // D2 on XIAO
const int SCK_PIN  = 5;   // D3 on XIAO
const int TARE_BTN = 9;   // BOOT button

// ---- Auto tare ----
const float EMPTY_THRESHOLD_G = 12.0;  // below this the platform counts as empty
const int   EMPTY_READINGS    = 6;     // about 3 seconds of empty before re-zeroing
const float STABLE_SPREAD_G   = 1.0;   // readings must stay this close together to count as empty

const unsigned long WARMUP_MS = 3000;  // the HX711 and load cell drift most right after power-up

// ---- Calibration ----
const double CAL_MIN_COUNTS = 2000;    // a few grams of raw signal; below this, noise sets the factor
const int    CAL_TRIES      = 5;       // about 15 seconds to get the known weight on and settled

const unsigned long SEND_MS = 20;     // about 2 readings a second, as the server expects

HX711 scale;
Preferences prefs;
float calFactor = 0;
int emptyCount = 0;

// Last line the app wrote to the command characteristic. BLE runs on its own task,
// so writes still arrive while calibrate() blocks loop().
String bleLine;
volatile bool bleLineReady = false;

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    bleLine = String(c->getValue().c_str());
    bleLine.trim();
    bleLineReady = true;
  }
};

// Tells the app which calibration step the scale is on
void setStatus(const String& s) {
  statusCh->setValue(s);
  statusCh->notify();
}

// Next line from Serial or the app, whichever comes first
String waitForLine() {
  while (!Serial.available() && !bleLineReady) delay(10);
  String s;
  if (bleLineReady) {
    s = bleLine;
    bleLineReady = false;
  } else {
    s = Serial.readStringUntil('\n');
  }
  s.trim();
  return s;
}

// Re-zeroes on whatever is on the platform now and saves it as the zero for the next boot
void zero() {
  scale.tare(20);
  prefs.putLong("offset", scale.get_offset());
  emptyCount = 0;
}

void calibrate() {
  Serial.println("\n--- CALIBRATION ---");
  Serial.println("Remove everything from the scale, then press Enter.");
  setStatus("cal:empty");
  if (waitForLine() == "x") {   // app backed out before anything changed
    Serial.println("Calibration cancelled.");
    setStatus("cal:cancelled");
    return;
  }
  scale.set_scale();        // reset to raw units
  zero();
  Serial.println("Tared. Place a KNOWN weight on the scale.");
  Serial.println("Type its weight in grams (e.g. 500) and press Enter:");
  setStatus("cal:weight");
  float known = waitForLine().toFloat();
  if (known <= 0) {
    Serial.println("Invalid weight, calibration cancelled.");
    if (calFactor != 0) scale.set_scale(calFactor);
    setStatus("cal:cancelled");
    return;
  }
  // Wait for the weight to be on and settled: two averages that agree, and far enough
  // from zero that noise can't set the factor (or flip its sign).
  double reading = 0;
  bool settled = false;
  for (int i = 0; i < CAL_TRIES && !settled; i++) {
    delay(1000);
    double a = scale.get_value(10);
    double b = scale.get_value(10);
    reading = (a + b) / 2;
    settled = fabs(reading) >= CAL_MIN_COUNTS && fabs(a - b) <= 0.02 * fabs(reading);
  }
  if (!settled) {
    Serial.println("No steady weight on the scale, calibration failed. Kept the previous calibration.");
    if (calFactor != 0) scale.set_scale(calFactor);
    setStatus("cal:failed");
    return;
  }
  calFactor = reading / known;
  scale.set_scale(calFactor);
  prefs.putFloat("cal", calFactor);
  Serial.printf("Calibration factor: %.4f (saved)\n", calFactor);
  Serial.println("Remove the weight. Done!\n");
  setStatus("cal:done");
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

  BLEService* service = server->createService(SERVICE_UUID);
  ch = service->createCharacteristic(
         "abcd1234-5678-90ab-cdef-1234567890ab",
         BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  ch->addDescriptor(new BLE2902());

  // App -> scale: "c" = calibrate, "t" = tare, and the answers to calibrate()'s prompts
  BLECharacteristic* cmdCh = service->createCharacteristic(
         "abcd1235-5678-90ab-cdef-1234567890ab",
         BLECharacteristic::PROPERTY_WRITE);
  cmdCh->setCallbacks(new CommandCallbacks());

  statusCh = service->createCharacteristic(
         "abcd1236-5678-90ab-cdef-1234567890ab",
         BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  statusCh->addDescriptor(new BLE2902());
  statusCh->setValue("ready");
  service->start();
  // iOS only finds devices in the background by service UUID, so advertise it.
  server->getAdvertising()->addServiceUUID(SERVICE_UUID);
  server->getAdvertising()->start();
  Serial.println("BLE ready. Look for 'SWIG-SCALE'.");

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
  delay(WARMUP_MS);

  if (calFactor == 0) {
    Serial.println("Not calibrated yet.");
    calibrate();
  } else {
    scale.set_scale(calFactor);
    Serial.printf("Loaded calibration factor: %.4f\n", calFactor);
    // A cup left on at power-up would become the zero and read negative once lifted,
    // so keep the saved zero when it shows something on the platform.
    long savedOffset = prefs.getLong("offset", 0);
    scale.set_offset(savedOffset);
    if (savedOffset != 0 && scale.get_units(20) > EMPTY_THRESHOLD_G) {
      Serial.println("Something is on the scale, keeping the saved zero.");
    } else {
      zero();
    }
  }
  Serial.println("Commands: 't' = tare, 'c' = recalibrate");
}

void loop() {
    String cmd;
    if (Serial.available()) {
      cmd = Serial.readStringUntil('\n');
      cmd.trim();
    } else if (bleLineReady) {
      cmd = bleLine;
      bleLineReady = false;
    }
    if (cmd == "t") { zero(); Serial.println("Tared."); }
    else if (cmd == "c") calibrate();

  // BOOT button tare
  static unsigned long lastPress = 0;
  if (digitalRead(TARE_BTN) == LOW && millis() - lastPress > 500) {
    lastPress = millis();
    zero();
    Serial.println("Tared (button).");
  }
  // Weigh and send. Uncalibrated readings are raw counts, so send nothing until calibrated.
  static unsigned long lastSend = 0;
  if (calFactor != 0 && millis() - lastSend >= SEND_MS && scale.is_ready()) {
    lastSend = millis();
    float grams = scale.get_units(5);

    // Auto tare: platform steady and nearly empty for about 3 seconds -> shift the zero by
    // the average drift, so creep and temperature drift never build up. Readings that
    // move (a cup going on or off) restart the window, so a cup never ends up in the zero.
    static float emptyMin, emptyMax, emptySum;
    if (fabs(grams) < EMPTY_THRESHOLD_G) {
      if (emptyCount == 0 || fmaxf(emptyMax, grams) - fminf(emptyMin, grams) > STABLE_SPREAD_G) {
        emptyCount = 0;
        emptyMin = emptyMax = grams;
        emptySum = 0;
      }
      emptyMin = fminf(emptyMin, grams);
      emptyMax = fmaxf(emptyMax, grams);
      emptySum += grams;
      if (++emptyCount >= EMPTY_READINGS) {
        float drift = emptySum / emptyCount;
        if (fabs(drift) >= 0.5) {
          scale.set_offset(scale.get_offset() + lround(drift * scale.get_scale()));
          grams -= drift;
          Serial.printf("Tared (auto, %.1f g drift).\n", drift);
        }
        emptyCount = 0;
      }
    } else {
      emptyCount = 0;
    }

    if (fabs(grams) < 0.5) grams = 0;   // hide tiny noise around zero

    String Sgram = String(grams);
    ch->setValue(Sgram);
    ch->notify();
    Serial.printf("Weight: %.1f g\n", grams);
  }
  delay(10);
}