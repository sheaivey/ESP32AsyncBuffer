#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include "models/Settings.h"

// Remember to generate the sources. For details visit the link below.
// https://github.com/sheaivey/ESP32AsyncBuffer#installation
#include "dist/_GENERATED_SOURCE.h" // should be included before 'AsyncWebServerBuffer.h'
#include "AsyncWebServerBuffer.h"

// Wi-Fi credentials
const char* ssid = "MyWiFi";
const char* password = "password";

// Create AsyncWebServer
AsyncWebServerBuffer server(80);

// Handle 404 and OPTIONS
void notFound(AsyncWebServerRequest *request)
{
  Serial.print(F("404: "));
  Serial.println(request->url());
  request->send(404, "text/plain", "404: Not found!");
}

void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(1000);
      Serial.println("Connecting to WiFi...");
    }
    
    Serial.println("Connected!");
    Serial.println(WiFi.localIP());
    
    server.onBuffer("/api/Settings", AsyncBufferType::SETTINGS, (uint8_t *)&settings, sizeof(settings),
      [](AsyncWebServerRequest *request) { // on GET response
        // You can update or modify settings or add headers to 
        // the response here before it is sent off to the client.
        Serial.printf("GET %s OK!\n", request->url());
        return true; // send the response
      }, 
      [](AsyncWebServerRequest *request) { // on POST response
        // settings data has been updated you can do something 
        // here with the modified data before sending the 
        // response back to the client.
        Serial.printf("POST %s OK!\n", request->url());
        return true; // send the response
      }
    );

    // CORS only needed for STA mode
    // server.disableCORS(); // useful for local development
    server.onNotFound(notFound);
    server.begin();
}

void loop() {
    // Nothing needed here (handled asynchronously)
}
