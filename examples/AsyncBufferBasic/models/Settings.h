// Settings.h
#ifndef Settings_H
#define Settings_H

#pragma pack(1) // tells the compiler not to optimize the byte order
struct Color {
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

#pragma pack(1)
struct Settings {
  char ssid[16] = "mySsid";
  char password[16] = "password";
  uint8_t mode = 1;
  float version = 1.1;
  Color color = {0}; // black
  Color colors[3] = {0}; // black
};

Settings settings;

#endif