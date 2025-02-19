#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include "models/Settings.h"
#include "AsyncWebServerBuffer.h"
#include "FS.h"
#include "SPIFFS.h"

#include "dist/_STATIC_HTML_FILES.h"

// Wi-Fi credentials
const char* ssid = "MyWiFi";
const char* password = "password";

// Create AsyncWebServer
AsyncWebServerBuffer server(80);

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

int test_int = 0;
int test_int_array[10] = {0};
void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(1000);
      Serial.println("Connecting to WiFi...");
    }
    

    Serial.println("Connected!");
    Serial.println(WiFi.localIP());

    initializeStaticFilesRequests(&server);

    // Adds GET, POST ArrayBuffer routes on the server listener.
    server.onBuffer("/api/int", "int", (uint8_t*)&test_int, sizeof(test_int) );    
    
    // GET index of intArray
    server.on("/api/intArray/*", HTTP_GET, [](AsyncWebServerRequest *request) { 
      const char type[] = "int";
      int index = request->url().substring(14).toInt();
      if(index < 0 || index >= sizeof(test_int_array) / sizeof(test_int_array[0])) {
        notFound(request);
        return;
      }
      server.sendResponseBuffer(request, type, (uint8_t *)&test_int_array[index], sizeof(test_int_array[index])); 
    });
    // POST index of intArray
    server.on("/api/intArray/*", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *requestData, size_t requestSize, size_t requestIndex, size_t requestTotal) { 
      const char type[] = "int";
      int index = request->url().substring(14).toInt(); 
      if(index < 0 || index >= sizeof(test_int_array) / sizeof(test_int_array[0])) {
        notFound(request);
        return;
      }
      if(server.processRequestBuffer(request, requestData, requestSize, requestIndex, requestTotal, type, (uint8_t *)&test_int_array[index], sizeof(test_int_array[index])) == AsyncWebServerBufferStatus::SUCCESS){
        server.sendResponseBuffer(request, type, (uint8_t *)&test_int_array[index], sizeof(test_int_array[index]));
      }
    });

    server.onBuffer("/api/intArray", "int", (uint8_t *)&test_int_array, sizeof(test_int_array));
    server.onBuffer("/api/Settings", "Settings", (uint8_t *)&settings, sizeof(settings));
    server.onBuffer("/api/AllTypes", "AllTypes", (uint8_t *)&allTypes, sizeof(allTypes));

    // CORS only needed for STA mode
    // server.disableCORS(); // useful for local development
    server.onNotFound(notFound);
    server.begin();
}

void loop() {
    // Nothing needed here (handled asynchronously)
}
