// AsyncWebServerBuffer.h
#ifndef AsyncWebServerBuffer_H
#define AsyncWebServerBuffer_H

#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>

enum AsyncWebServerBufferStatus {
  TYPE_HEADER_MISSING = -1,
  TYPE_HEADER_MISMATCH = -2,
  CHECKSUM_HEADER_MISMATCH = -3,
  BUFFER_SIZE_MISMATCH = -4,
  PROCESSING_BUFFER_CHUNK = 0,
  SUCCESS = 1,
};

class AsyncWebServerBuffer : public AsyncWebServer
{
  public:
    AsyncWebServerBuffer(uint16_t port = 80) : AsyncWebServer(port) {};

    void onStatic(const char *uri, const char *contentType, const uint8_t *body, size_t len, const char *etag, bool gzip) {
      on(uri, HTTP_GET, [uri, body, len, etag, gzip, contentType](AsyncWebServerRequest *request) {
        if(request->hasHeader("If-None-Match")) {
          String requestETag = request->getHeader("If-None-Match")->value();
          if(requestETag == etag) {
            request->send(304);
            return;
          }
        }
        AsyncWebServerResponse *response = request->beginResponse_P(200, contentType, body, len);
        response->addHeader("Cache-Control", "max-age: 60");
        response->addHeader("ETag", etag);
        if(gzip) {
          response->addHeader("Content-Encoding", "gzip");
        }
        request->send(response);
      });
    }

    // Function to compute Fletcher16 checksum
    uint16_t 
    computeChecksum(
      const uint8_t *data, 
      size_t length
    ) {
      uint16_t sum1 = 0;
      uint16_t sum2 = 0;
      for (size_t i = 0; i < length; i++)
      {
        sum1 = (sum1 + data[i]) % 255;
        sum2 = (sum2 + sum1) % 255;
      }
      return (sum2 << 8) | sum1;
    }

    AsyncWebServerBufferStatus 
    sendResponseBuffer(
      AsyncWebServerRequest *request, 
      const String &type, 
      uint8_t *data, 
      size_t dataSize
    ) {
      AsyncWebServerResponse *response = request->beginResponse_P(200, "application/octet-stream", data, dataSize);
      if (request->hasHeader("X-Type"))
      { // optional but good for sanity checking in the client.
        String requestType = request->getHeader("X-Type")->value();
        if (type != requestType)
        {
          request->send(400, "text/plain", "Expected X-Type header to be " + type);
          return AsyncWebServerBufferStatus::TYPE_HEADER_MISMATCH;
        }
      }
      if (request->hasHeader("X-Checksum"))
      {
        String checksum = String(computeChecksum(data, dataSize));
        response->addHeader("X-Checksum", checksum);
      }
      response->addHeader("X-Type", type);
      request->send(response);
      return AsyncWebServerBufferStatus::SUCCESS;
    }

    AsyncWebServerBufferStatus 
    processRequestBuffer(
      AsyncWebServerRequest *request, 
      uint8_t *requestData, 
      size_t requestSize, 
      size_t requestIndex, 
      size_t requestTotal, 
      const String &type, 
      uint8_t *typeData, 
      size_t typeSize
    ) {
      if (!request->hasHeader("X-Type"))
      {
        request->send(400, "text/plain", "Missing X-Type header");
        return AsyncWebServerBufferStatus::TYPE_HEADER_MISSING;
      }
      String requestType = request->getHeader("X-Type")->value();
      if (type != requestType)
      {
        request->send(400, "text/plain", "Expected X-Type header to be " + type);
        return AsyncWebServerBufferStatus::TYPE_HEADER_MISMATCH;
      }
      if (requestTotal == typeSize)
      {
        if (requestSize + requestIndex < requestTotal)
        { // large requestData!! size must overwrite the original data :(
          memcpy(((uint8_t *)typeData) + requestIndex, requestData, requestSize);
          return AsyncWebServerBufferStatus::PROCESSING_BUFFER_CHUNK; // processing chunks
        }
        if (!request->hasHeader("X-Checksum"))
        {
          memcpy(((uint8_t *)typeData) + requestIndex, requestData, requestSize);
          return AsyncWebServerBufferStatus::SUCCESS; // all done!
        }
        String requestChecksum = request->getHeader("X-Checksum")->value();
        String calculatedChecksum;
        if (requestSize < requestTotal)
        {
          // large payloads must finish loading data before checking calculating checksum. :(
          memcpy(((uint8_t *)typeData) + requestIndex, requestData, requestSize);
          calculatedChecksum = String(computeChecksum(typeData, typeSize));
        }
        else
        {
          calculatedChecksum = String(computeChecksum(requestData, requestSize));
        }
        if (requestChecksum == calculatedChecksum)
        {
          if (requestSize == requestTotal)
          {
            // small payloads can check the checksum before copying the payload :)
            memcpy(((uint8_t *)typeData) + requestIndex, requestData, requestSize);
          }
          return AsyncWebServerBufferStatus::SUCCESS; // all done!!
        }
        else
        {
          request->send(400, "text/plain", "Invalid checksum");
          return AsyncWebServerBufferStatus::CHECKSUM_HEADER_MISMATCH;
        }
      }
      request->send(400, "text/plain", "Invalid binary size");
      return AsyncWebServerBufferStatus::BUFFER_SIZE_MISMATCH;
    }

    std::function<void(AsyncWebServerRequest *)> 
    sendBufferData(
      const String &type, 
      uint8_t *data, 
      size_t size, 
      std::function<bool(AsyncWebServerRequest *)> callback = nullptr
    ) {
      return [this, type, data, size, callback](AsyncWebServerRequest *request)
      {
        // Execute the callback function
        bool sendResponse = true;
        if (callback)
        {
          sendResponse = callback(request);
        }
        // dont respond until the callback has been called.
        if (sendResponse)
        {
          sendResponseBuffer(request, type, data, size); // Execute the callback function
        }
        else
        {
          request->send(200, "text/plain", "SUCCESS!");
        }
      };
    }

    std::function<void(AsyncWebServerRequest *, uint8_t *, size_t, size_t, size_t)> 
    receiveBufferData(
      const String &type, 
      uint8_t *data, 
      size_t size, 
      std::function<bool(AsyncWebServerRequest *)> callback = nullptr, 
      bool handleResponse = true
    ) {
      return [this, type, data, size, callback, handleResponse](AsyncWebServerRequest *request, uint8_t *buffer, size_t len, size_t index, size_t total)
      {
        if (processRequestBuffer(request, buffer, len, index, total, type, data, size) == AsyncWebServerBufferStatus::SUCCESS)
        {
          bool sendResponse = handleResponse;
          if (callback)
          {
            sendResponse = callback(request);
          }
          // dont respond until the call back has been called.
          if (sendResponse)
          {
            sendResponseBuffer(request, type, data, size); // Execute the callback function
          }
          else
          {
            request->send(200, "text/plain", "SUCCESS!");
          }
        }
      };
    }

    // Creates GET and POST routes to handle sending and updating the provided data at the URI path.
    void onBuffer(
      const char *uri,
      const String &type,
      uint8_t *data,
      size_t size,
      std::function<bool(AsyncWebServerRequest *)> getCallback = nullptr,
      std::function<bool(AsyncWebServerRequest *)> setCallback = nullptr, 
      bool handleResponse = true
    ) {
      on(uri, HTTP_GET, sendBufferData(type, data, size, getCallback));
      on(uri, HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, receiveBufferData(type, data, size, setCallback, handleResponse));
    }

    // Creates a route at the URI path and method to handle the provided data.
    void onBuffer(
      const char *uri,
      WebRequestMethod method,
      const String &type,
      uint8_t *data,
      size_t size,
      std::function<bool(AsyncWebServerRequest *)> callback = nullptr, 
      bool handleResponse = true
    ) {
      if(method == HTTP_GET) {
        on(uri, HTTP_GET, sendBufferData(type, data, size, callback));
      }
      else {
        on(uri, method, [](AsyncWebServerRequest *request) {}, NULL, receiveBufferData(type, data, size, callback, handleResponse));
      }
    }

    void disableCORS() {
      static bool _disabledCORS = false;
      if (_disabledCORS)
      {
        // CORS only needed for STA mode
        return;
      }
      on("*", HTTP_OPTIONS, [](AsyncWebServerRequest *request) { request->send(200, "text/plain", ""); });
      DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
      DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "*");
      DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "*");
      DefaultHeaders::Instance().addHeader("Access-Control-Expose-Headers", "*");
      _disabledCORS = true;
    }
  };


#endif