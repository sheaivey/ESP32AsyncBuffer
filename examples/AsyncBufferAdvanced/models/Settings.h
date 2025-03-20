// Settings.h
#ifndef Settings_H
#define Settings_H
#include <FastLED.h>

#pragma pack(1)
struct SubSetting {
  uint8_t id;
  bool enabled;
  unsigned long value; 
};

#pragma pack(1)
struct Color {
  uint8_t r;
  uint8_t g;
  uint8_t b;
  void test() {

  };
  CRGB toCRGB() {
    static CRGB c = CRGB(this->r, this->g, this->b);
    return c;
  };
  void operator = (const CRGB c) {
    this->r = c.r;
    this->g = c.r;
    this->b = c.b;
  };
};

#pragma pack(1)
struct Settings {
  char ssid[16];
  char password[16];
  uint8_t mode;
  float version;
  SubSetting sub;
  SubSetting subSettings[5]; // Array of structs
  Color colors[3];
};

#pragma pack(1)
struct AllTypes
{
  bool _bool;
  char _char;
  unsigned char _unsignedChar;
  int8_t _int8_t;
  uint8_t _uint8_t;
  short _short;
  unsigned short _unsignedShort;
  int16_t _int16_t;
  uint16_t _uint16_t;
  int _int;
  unsigned int _unsignedInt;
  int32_t _int32_t;
  uint32_t _uint32_t;
  float _float;
  long _long;
  unsigned long _unsignedLong;
  long long _longLong;
  unsigned long long _unsignedLongLong;
  double _double;
};

struct StreamData {
  uint32_t id = 0;
  size_t clients = 0;
  int frame = 0;
  float fps = 0;
  unsigned long time = 0;
};

#endif