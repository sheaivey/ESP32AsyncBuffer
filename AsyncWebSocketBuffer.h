// AsyncWebSocketBuffer.h
#ifndef AsyncWebSocketBuffer_H
#define AsyncWebSocketBuffer_H

#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include "AsyncBuffer.h"
class AsyncWebSocketBuffer;
class AsyncWebSocketClientBuffer;

enum class AsyncWebSocketBufferStatus {
  TYPE_HEADER_MISMATCH = -1,
  BUFFER_SIZE_MISMATCH = -2,
  SUCCESS = 1,
  GET = 2,
  SET = 3,
};

using AsyncWebSocketBufferCallback = std::function<bool(AsyncWebSocketClientBuffer *client, String command, AsyncBufferType type, uint8_t *data, size_t len, AsyncWebSocketBufferStatus status)>;

struct AsyncWebSocketBufferCommand {
  String command = "";
  AsyncBufferType type;
  uint8_t *buffer = nullptr;
  size_t length = 0;
  AsyncWebSocketBufferCallback callback = nullptr;
};

struct AsyncWebSocketBufferRequest {
  String command = "";
  String typeName = "";
  AsyncBufferType type;
  uint64_t length = 0;
  uint64_t index = 0;
};

std::shared_ptr<std::vector<uint8_t>> makeSocketPayloadBuffer(String command, AsyncBufferType type, uint8_t *data, size_t len) {
  String header = command + ";" + String((int)type) + ";";
  uint8_t headerLen = header.length();
  auto buffer = std::make_shared<std::vector<uint8_t>>(headerLen + len, 0);
  memcpy(buffer->data(), header.c_str(), headerLen);
  memcpy(buffer->data() + headerLen, data, len);
  return buffer;
}

class AsyncWebSocketClientBuffer : public AsyncWebSocketClient
{
  public:
    bool sendBuffer(String command) {
      String header = command + ";0;" + 1; // respond with true
      return binary(header);
    }

    bool sendBuffer(String command, AsyncBufferType type, uint8_t *data, size_t len) {
      return binary(makeSocketPayloadBuffer(command, type, data, len));
    };
};

class AsyncWebSocketBuffer : public AsyncWebSocket
{
  std::list<std::unique_ptr<AsyncWebSocketBufferCommand>> _commands;
  AsyncWebSocketBufferCommand *processingCommand = nullptr;
  AsyncWebSocketBufferRequest _request;
  public:
    AsyncWebSocketBuffer(const char * url = "/ws") : AsyncWebSocket(url) {
      onEvent([this](AsyncWebSocket* wsServer, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
        this->_onBufferEvent(wsServer, (AsyncWebSocketClientBuffer *)client, type, arg, data, len);
      });
    };

    AsyncWebSocketClientBuffer *client(uint32_t id) {
      return (AsyncWebSocketClientBuffer*) AsyncWebSocket::client(id);
    }

    bool sendBuffer(uint32_t id, String command) {
      AsyncWebSocketClientBuffer* c = (AsyncWebSocketClientBuffer*) client(id);
      return c->sendBuffer(command);
    }

    bool sendBuffer(uint32_t id, String command, AsyncBufferType type, uint8_t *data, size_t len) {
      AsyncWebSocketClientBuffer* c = (AsyncWebSocketClientBuffer*) client(id);
      return c->sendBuffer(command, type, data, len);
    };

    bool sendBufferAll(String command) {
      for (auto& t : getClients()) {
        AsyncWebSocketClientBuffer* c = (AsyncWebSocketClientBuffer*) &t;
        if (c->status() == WS_CONNECTED) {
          c->sendBuffer(command);
        }
      }
      return true;
    }

    bool sendBufferAll(String command, AsyncBufferType type, uint8_t *data, size_t len) {
      for (auto& t : getClients()) {
        AsyncWebSocketClientBuffer* c = (AsyncWebSocketClientBuffer*) &t;
        if (c->status() == WS_CONNECTED) {
          c->sendBuffer(command, type, data, len);
        }
      }
      return true;
    }
    
    void onBuffer(
      String command, 
      AsyncWebSocketBufferCallback callback = nullptr
    ) {
      onBuffer(command, AsyncBufferType::UNKNOWN_TYPE, nullptr, 0, callback);
    }

    void onBuffer(
      String command, 
      AsyncBufferType type = AsyncBufferType::UNKNOWN_TYPE,
      AsyncWebSocketBufferCallback callback = nullptr
    ) {
      onBuffer(command, type, nullptr, 0, callback);
    }

    // register command listeners
    void onBuffer(
      String command, 
      AsyncBufferType type = AsyncBufferType::UNKNOWN_TYPE,
      uint8_t *buffer = nullptr,
      size_t length = 0,
      AsyncWebSocketBufferCallback callback = nullptr
    ) {
      AsyncWebSocketBufferCommand* c = new AsyncWebSocketBufferCommand();

      c->command = command;
      c->type = type;
      c->buffer = buffer;
      c->length = length;
      c->callback = callback;
      _commands.emplace_back(c);
    }

  private:
    void _onBufferEvent(AsyncWebSocket* wsServer, AsyncWebSocketClientBuffer* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
      if (type == WS_EVT_CONNECT) {
      } else if (type == WS_EVT_DISCONNECT) {
      } else if (type == WS_EVT_ERROR) {
      } else if (type == WS_EVT_DATA) {
        AwsFrameInfo * info = (AwsFrameInfo*)arg;
        uint64_t total = info->len;
        bool isPartial = info->index != total;
        bool isFirst = info->index == 0; // num is the current offset
        bool isLast = info->index + len == total; // num is the current offset

        size_t bodyOffset = 0;
        size_t bodyLen = len;
        if(isFirst) {
          if(len <= 2) {
            //ignore empty payloads.
            return;
          }
          String header[] = {
            "", // command header
            "" // type header
          };
          String type = "";
          uint8_t hIdx = 0;
          for(int i = 0; i < len; i++) {
            if(hIdx == 2) {
              break; // all done
            }
            if(data[i] == ';') {
              hIdx++;
              continue; // start next header
            }
            header[hIdx] += (char) data[i];
          }
          bodyOffset = header[0].length() + header[1].length() + hIdx;

          _request.length = total-bodyOffset;
          _request.index = 0;
          bodyLen = len - bodyOffset;

          _request.command = header[0];
          _request.type = getAsyncTypeFromName(header[1]);
          _request.typeName = getAsyncTypeName(_request.type);
        }
        uint8_t *body = data + bodyOffset;

        // for debugging partial chunks
        // Serial.printf("command=%s type=%s length=%" PRIu64 " index=%" PRIu64 " \n", _request.command.c_str(), _request.typeName.c_str(), _request.length, _request.index);

        for (auto it = _commands.begin(); it != _commands.end(); ++it) {
          AsyncWebSocketBufferCommand *c = it->get();
          if (c->command == _request.command) {
            AsyncWebSocketBufferStatus status = AsyncWebSocketBufferStatus::GET;
            // Found the command 
            if(c->type != AsyncBufferType::UNKNOWN_TYPE) {
              // command requires a type
              if(c->type == _request.type) {
                // has valid type
                if(c->length == _request.length) {
                  // has valid data
                  if(c->buffer != nullptr) {
                    // data has a home
                    memcpy(c->buffer + _request.index, body, bodyLen);
                    _request.index += bodyLen;
                  }
                  status = AsyncWebSocketBufferStatus::SET;
                }
                else if (c->length != 0 && _request.length != 0) {
                  // has invalid data
                  if(isLast) {
                    Serial.printf("Invalid buffer size, expected %d but received %d\n", c->length, _request.length);
                  }
                  status = AsyncWebSocketBufferStatus::BUFFER_SIZE_MISMATCH;
                }
                else if(c->length == 0 && _request.length != 0) {
                  // has data but length variable.
                  status = AsyncWebSocketBufferStatus::SET;
                }
              }
              else if(_request.length != 0) {
                // data was sent but type is invalid
                if(isLast) {
                  Serial.printf("Invalid type, expected %s but received %s\n", getAsyncTypeName(c->type), _request.typeName);
                }
                status = AsyncWebSocketBufferStatus::TYPE_HEADER_MISMATCH;
              }
            }
            
            if(isLast) {
              // all done!
              bool handleSend = true;
              if(c->callback != nullptr) {
                handleSend = c->callback(client, _request.command, _request.type, body, len, status);
              }

              if(handleSend) {
                if(c->buffer != nullptr) {
                  client->sendBuffer(_request.command, c->type, c->buffer, c->length);
                }
                else {
                  client->sendBuffer(_request.command); // respond true
                }
              }
            }
          }
        }
      } else if (type == WS_EVT_PONG) {
      } else if (type == WS_EVT_PING) {
      } else {
        //Serial.printf("Client #%" PRIu32 " unknown event %d\n", client->id(), type);
      }
    }
};

#endif