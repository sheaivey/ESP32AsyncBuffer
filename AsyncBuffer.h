// AsyncBuffer.h
#ifndef AsyncBuffer_H
#define AsyncBuffer_H

struct AsyncBufferStaticFile {
  const char *url;
  const char *type;
  const char *etag;
  const uint8_t *body;
  size_t length;
  bool gzip;
};

#ifdef _ASYNC_BUFFER_GENERATED_SOURCE_INCLUDE
  #include _ASYNC_BUFFER_GENERATED_SOURCE_INCLUDE
#else
  #pragma message ("\n\n_ASYNC_BUFFER_GENERATED_SOURCES_INCLUDE is not defined! \n  You may need to run:\n  node Arduino/libraries/ESP32AsyncBuffer/GenerateSources.js\n\n  Falling back to primitive types only.\n\n")
  // including the bare minimum /js/models.js and primitive types
  #include "./dist/_GENERATED_SOURCE.h"
#endif

#define _ASYNC_BUFFER_NO_CHECKSUM_FLAG 0xFFFF

const char* getAsyncTypeName(AsyncBufferType type) {
  if(type < 0 || type >= AsyncBufferType::_EOF) {
    return "unknown type";
  }
  return AsyncBufferTypeNames[type];
}

AsyncBufferType getAsyncTypeFromName(const char* typeName) {
  if(typeName[0] >= '0' && typeName[0] <= '9') { // is the string a number?
    return (AsyncBufferType) atoi(typeName);
  }
  for (size_t i = AsyncBufferType::_EOF - 1; i >= 0; --i) {
    if (strcmp(AsyncBufferTypeNames[i], typeName) == 0) {
      return (AsyncBufferType) i; // Found, return index
    }
  }
  return AsyncBufferType::UNKNOWN_TYPE;
}

// Function to compute Fletcher16 checksum
uint16_t computeChecksum(const uint8_t *data, size_t length) {
  if(_ASYNC_BUFFER_USE_CHECKSUM == false) {
    return _ASYNC_BUFFER_NO_CHECKSUM_FLAG; // no checksum
  }
  uint16_t sum1 = 0;
  uint16_t sum2 = 0;
  for (size_t i = 0; i < length; i++)
  {
    sum1 = (sum1 + data[i]) % 255;
    sum2 = (sum2 + sum1) % 255;
  }
  return (sum2 << 8) | sum1;
}

#endif