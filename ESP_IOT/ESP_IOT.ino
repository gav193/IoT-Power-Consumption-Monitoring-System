#include <PZEM004Tv30.h>
#include <math.h>
#include <WiFi.h>
#include <PubSubClient.h>

#define PZEM_RX_PIN 16
#define PZEM_TX_PIN 17
#define SSR_PIN     18

HardwareSerial pzemSerial(2);
PZEM004Tv30 pzem(pzemSerial, PZEM_RX_PIN, PZEM_TX_PIN);

const char* ssid = "Htsp";
const char* password = "Ra170903";

const char* mqtt_server = "public.cloud.shiftr.io";
const int mqtt_port = 1883;
const char* mqtt_user = "public";
const char* mqtt_pass = "public";

const char* dataTopic = "LBCMH/1/data";
const char* cmdTopic  = "LBCMH/1/cmd";

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastPublish = 0;
const unsigned long publishInterval = 2000;

String getClientId() {
  uint8_t mac[6];
  WiFi.macAddress(mac);

  char clientId[32];

  snprintf(
    clientId,
    sizeof(clientId),
    "ESP32_%02X%02X%02X%02X%02X%02X",
    mac[0],
    mac[1],
    mac[2],
    mac[3],
    mac[4],
    mac[5]
  );

  return String(clientId);
}

void setup_wifi() {
  delay(10);

  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void publishPZEMData() {
  float voltage   = pzem.voltage();
  float current   = pzem.current();
  float power     = pzem.power();
  float energy    = pzem.energy();
  float frequency = pzem.frequency();
  float pf        = pzem.pf();

  if (
    isnan(voltage) ||
    isnan(current) ||
    isnan(power) ||
    isnan(energy) ||
    isnan(frequency) ||
    isnan(pf)
  ) {
    Serial.println("Error reading PZEM data. Data not published.");
    return;
  }

  bool relayState = digitalRead(SSR_PIN);

  char payload[300];

  snprintf(
    payload,
    sizeof(payload),
    "{"
      "\"voltage\":%.1f,"
      "\"current\":%.2f,"
      "\"power\":%.1f,"
      "\"energy\":%.3f,"
      "\"frequency\":%.1f,"
      "\"pf\":%.2f,"
      "\"relay_state\":%s"
    "}",
    voltage,
    current,
    power,
    energy,
    frequency,
    pf,
    relayState ? "true" : "false"
  );

  client.publish(dataTopic, payload);

  Serial.print("Published to ");
  Serial.print(dataTopic);
  Serial.print(": ");
  Serial.println(payload);
}

void printPZEMData() {
  float voltage   = pzem.voltage();
  float current   = pzem.current();
  float power     = pzem.power();
  float energy    = pzem.energy();
  float frequency = pzem.frequency();
  float pf        = pzem.pf();

  if (isnan(voltage)) {
    Serial.println("Error reading voltage");
  } else if (isnan(current)) {
    Serial.println("Error reading current");
  } else if (isnan(power)) {
    Serial.println("Error reading power");
  } else if (isnan(energy)) {
    Serial.println("Error reading energy");
  } else if (isnan(frequency)) {
    Serial.println("Error reading frequency");
  } else if (isnan(pf)) {
    Serial.println("Error reading power factor");
  } else {
    Serial.print("Voltage: ");
    Serial.print(voltage);
    Serial.println(" V");

    Serial.print("Current: ");
    Serial.print(current);
    Serial.println(" A");

    Serial.print("Power: ");
    Serial.print(power);
    Serial.println(" W");

    Serial.print("Energy: ");
    Serial.print(energy, 3);
    Serial.println(" kWh");

    Serial.print("Frequency: ");
    Serial.print(frequency, 1);
    Serial.println(" Hz");

    Serial.print("PF: ");
    Serial.println(pf);
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";

  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  message.trim();

  Serial.print("Message arrived on topic: ");
  Serial.println(topic);

  Serial.print("Command: ");
  Serial.println(message);

  if (message == "ON") {
    digitalWrite(SSR_PIN, HIGH);
    Serial.println("SSR ON");
    publishPZEMData();
  }

  else if (message == "OFF") {
    digitalWrite(SSR_PIN, LOW);
    Serial.println("SSR OFF");
    publishPZEMData();
  }

  else if (message == "INFO") {
    printPZEMData();
    publishPZEMData();
  }

  else if (message == "HELP") {
    Serial.println("Available commands:");
    Serial.println("ON   : turn on SSR load");
    Serial.println("OFF  : turn off SSR load");
    Serial.println("INFO : print and publish PZEM data");
    Serial.println("HELP : show command list");
  }

  else {
    Serial.println("Command invalid. Try HELP.");
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection... ");

    String clientId = getClientId();

    Serial.print("Client ID: ");
    Serial.println(clientId);

    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("MQTT connected");

      client.subscribe(cmdTopic);

      Serial.print("Subscribed to: ");
      Serial.println(cmdTopic);
    }

    else {
      Serial.print("MQTT failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");

      delay(5000);
    }
  }
}

void handleSerialCommand() {
  if (Serial.available() > 0) {
    String incomingData = Serial.readStringUntil('\n');
    incomingData.trim();

    Serial.print("Serial received: ");
    Serial.println(incomingData);

    if (incomingData == "on" || incomingData == "ON") {
      digitalWrite(SSR_PIN, HIGH);
      Serial.println("SSR ON from Serial");
      publishPZEMData();
    }

    else if (incomingData == "off" || incomingData == "OFF") {
      digitalWrite(SSR_PIN, LOW);
      Serial.println("SSR OFF from Serial");
      publishPZEMData();
    }

    else if (incomingData == "info" || incomingData == "INFO") {
      printPZEMData();
      publishPZEMData();
    }

    else {
      Serial.println("Unknown command");
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(SSR_PIN, OUTPUT);
  digitalWrite(SSR_PIN, LOW);

  pzemSerial.begin(9600, SERIAL_8N1, PZEM_RX_PIN, PZEM_TX_PIN);

  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  Serial.println("ESP32 + PZEM + SSR + MQTT started");
  Serial.println("Pins:");
  Serial.println("PZEM RX = GPIO16");
  Serial.println("PZEM TX = GPIO17");
  Serial.println("SSR     = GPIO18");
  Serial.println();

  Serial.print("Data topic: ");
  Serial.println(dataTopic);

  Serial.print("Command topic: ");
  Serial.println(cmdTopic);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }

  client.loop();

  handleSerialCommand();

  unsigned long now = millis();

  if (now - lastPublish >= publishInterval) {
    lastPublish = now;
    publishPZEMData();
  }
}