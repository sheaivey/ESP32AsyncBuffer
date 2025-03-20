#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include "models/Settings.h"

// Remember to generate the sources. For details visit the link below.
// https://github.com/sheaivey/ESP32AsyncBuffer#how-does-it-work
#include "dist/_GENERATED_SOURCE.h"
#include "AsyncWebServerBuffer.h"
#include "AsyncWebSocketBuffer.h"

// Wi-Fi credentials
const char* ssid = "MyWiFi";
const char* password = "password";

// Create AsyncWebServer
AsyncWebServerBuffer server(80);
AsyncWebSocketBuffer ws("/ws");

// Default Settings
Settings settings = {
    "MyWiFi", "SecretPass", 2, 1.1, {42, true}, 
    {
      {1, false}, {2, false}, {3, false}, {4, false}, {5, false}
    },
    {
      {255, 255, 255},
    }
};
AllTypes allTypes = {0};

// Handle 404 and OPTIONS
void notFound(AsyncWebServerRequest *request)
{
  Serial.print(F("404: "));
  Serial.println(request->url());
  request->send(404, "text/plain", "404: Not found!");
}
uint32_t _streamClientId = 0;
uint8_t fps = 1; // 1 frame per second
int test_int = 0;
int test_int_array[10000] = {0};
unsigned long nextFrame = 0;
int frame = 0;

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  
  Serial.println("Connected!");
  Serial.println(WiFi.localIP());

  server.addHandler(&ws);

  // Adds GET, POST ArrayBuffer routes on the server listener.
  server.onBuffer("/api/int", AsyncBufferType::INT, (uint8_t*)&test_int, sizeof(test_int) );
  
  // GET index of intArray
  server.on("/api/ints/*", HTTP_GET, [](AsyncWebServerRequest *request) { 
    AsyncBufferType type = AsyncBufferType::INT;
    int index = request->url().substring(14).toInt();
    if(index < 0 || index >= sizeof(test_int_array) / sizeof(test_int_array[0])) {
      notFound(request);
      return;
    }
    server.sendResponseBuffer(request, type, (uint8_t *)&test_int_array[index], sizeof(test_int_array[index])); 
  });
  // POST index of ints
  server.on("/api/ints/*", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *requestData, size_t requestSize, size_t requestIndex, size_t requestTotal) { 
    AsyncBufferType type = AsyncBufferType::INT;
    int index = request->url().substring(14).toInt(); 
    if(index < 0 || index >= sizeof(test_int_array) / sizeof(test_int_array[0])) {
      notFound(request);
      return;
    }
    if(server.processRequestBuffer(request, requestData, requestSize, requestIndex, requestTotal, type, (uint8_t *)&test_int_array[index], sizeof(test_int_array[index])) == AsyncWebServerBufferStatus::SUCCESS){
      server.sendResponseBuffer(request, type, (uint8_t *)&test_int_array[index], sizeof(test_int_array[index]));
    }
  });

  server.onBuffer("/api/ints", AsyncBufferType::INT, (uint8_t *)&test_int_array, sizeof(test_int_array));
  server.onBuffer("/api/settings", AsyncBufferType::SETTINGS, (uint8_t *)&settings, sizeof(settings));
  server.onBuffer("/api/all-types", AsyncBufferType::ALLTYPES, (uint8_t *)&allTypes, sizeof(allTypes));

  // CORS only needed for STA mode
  server.disableCORS(); // useful for local development
  server.onNotFound(notFound);
  server.begin();

  // websocket listeners
  ws.onBuffer("settings", AsyncBufferType::SETTINGS, (uint8_t *)&settings, sizeof(settings), [](AsyncWebSocketClientBuffer *client, String command, AsyncBufferType type, uint8_t *data, size_t len, AsyncWebSocketBufferStatus status) {
    Serial.printf("%s settings\n", status == AsyncWebSocketBufferStatus::SET ? "SET" : "GET");
    return true; // send response?
  });
  ws.onBuffer("test_int_array", AsyncBufferType::INT, (uint8_t *)&test_int_array, sizeof(test_int_array), [](AsyncWebSocketClientBuffer *client, String command, AsyncBufferType type, uint8_t *data, size_t len, AsyncWebSocketBufferStatus status) {
    Serial.printf("%s test_int_array\n", status == AsyncWebSocketBufferStatus::SET ? "SET" : "GET");
    return true; // send response?
  });
  ws.onBuffer("fps", AsyncBufferType::UINT8_T, [](AsyncWebSocketClientBuffer *client, String command, AsyncBufferType type, uint8_t *data, size_t len, AsyncWebSocketBufferStatus status) {
    // validate fps value before setting
    if(status == AsyncWebSocketBufferStatus::SET) {
      uint8_t value = data[0];
      if(value > 0) {
        fps = value;
      }
      nextFrame = 0; // trigger next frame 
    }   
    Serial.printf("%s fps %d\n", status == AsyncWebSocketBufferStatus::SET ? "SET" : "GET", fps);
    return true; // send response?
  });
  ws.onBuffer("close", AsyncBufferType::SETTINGS, (uint8_t *)&settings, sizeof(settings), [](AsyncWebSocketClientBuffer *client, String command, AsyncBufferType type, uint8_t *data, size_t len, AsyncWebSocketBufferStatus status) {
    Serial.printf("Client #%d: closed\n", client->id());
    client->close();
    return false; // send response?
  });
  ws.onBuffer("help", [](AsyncWebSocketClientBuffer *client, String command, AsyncBufferType type, uint8_t *data, size_t len, AsyncWebSocketBufferStatus status) {
    String msg = "Command List:\n\nsettings [Settings Object]\nstream [int fps]\nfps [int]\ntest_int_array [int array]\nclose\nhelp";
    client->sendBuffer("help", AsyncBufferType::CHAR, (uint8_t *)msg.c_str(), msg.length());
    return false; // send response?
  });
  ws.onBuffer("stream", AsyncBufferType::UINT8_T, [](AsyncWebSocketClientBuffer *client, String command, AsyncBufferType type, uint8_t *data, size_t len, AsyncWebSocketBufferStatus status) {
    uint8_t value = 0;
    if(status == AsyncWebSocketBufferStatus::SET) { 
      // fps value or off
      value = data[0];
      if(value > 0) {
        fps = value;
        if(_streamClientId != 0 && _streamClientId != client->id()) {
          // stopping the previous stream
          Serial.printf("Client #%d: stop stream\n", _streamClientId);
        }
        _streamClientId = client->id();
        nextFrame = 0; // trigger next frame 
        Serial.printf("Client #%d: start stream @ %dfps\n", client->id(), fps);
      }
      else {
        Serial.printf("Client #%d: stop stream\n", client->id());
        _streamClientId = 0;
      }
    }
    else if(status == AsyncWebSocketBufferStatus::GET) {
      // return who is currently being streamed to
      client->sendBuffer("stream", AsyncBufferType::UINT32_T, (uint8_t *)_streamClientId, sizeof(_streamClientId));
    }
    return false; // send response?
  });
}


StreamData data;
unsigned long lastFrameTime = 0;
void loop() {
  ws.cleanupClients(); // cleanup any disconnected clients
  unsigned long now = micros();
  if(now < nextFrame) {
    return; // not time yet
  }
  frame++;
  nextFrame = now + (1000000.0F / (float)(fps));
  
  if(_streamClientId) {
    // You could provide a list of client IDs that have requested the data stream
    // but that is outside the scope of this example.
    // You could also just stream to all connected clients when any of the clients starts the stream.
    // For demonstration, stream to one client at a time.
    AsyncWebSocketClientBuffer *c = ws.client(_streamClientId);
    if(c != nullptr && c->status() == AwsClientStatus::WS_CONNECTED) {
      // stream data to client who asked for it.
      data.id = c->id();
      data.clients = ws.count();
      data.frame = frame;
      data.fps = 1000000.0F / (float)( now - lastFrameTime );
      data.time = millis();
      ws.sendBuffer(_streamClientId, "data", AsyncBufferType::STREAMDATA, (uint8_t *)&data, sizeof(data));
    }
  }
  lastFrameTime = now;
}
