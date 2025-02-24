# <img src="examples/AsyncBufferBasic/html/img/favicon.png" width="32" height="32" alt="ESP32AsyncBuffer" style="vertical-align: top" /> ESP32AsyncBuffer

This library provides solution to send or receive binary data structures to the client and with encoding and decoding helper functions so you can operate on the data easily.

### Why would you want this?
Using JSON to pass structured data around between client and server which can be a heavy operation to encode and parse on embedded both in memory and speed.
The idea here is simple, let the client do all the heavy work of encoding and decoding and let the microcontroler work directly with structured binary data.

# Features
- Extremely fast send/receive times
- Supports nested structures
- Uses almost no dynamic memory
- Transfer extremely large datasets
- Minimal over the wire payload sizes (no JSON fluff, just bytes!)
- Checksums
- `js/models.js` is 2.5kb for the client javascript code to encode and decode + any custom struct definitions found.
- GZIP `./html` directory and store in program storage for extremely fast responses.
- node script to watch for changes in `./models`, `./html`

# Installation
Please note that this is an over simplified setup and you should look at `./examples/AsyncBufferBasic` for a more comprehensive project example.

First you will need to clone or copy this library into 
```shell
~/Documents/Arduino/libraries/ESP32AsyncBuffer
```

In your arduino project include and create a server. 
```cpp
// ...
#include "dist/_STATIC_HTML_FILES.h" // this file will be generated
#include "AsyncWebServerBuffer.h"
#include "models/MyStruct.h"
AsyncWebServerBuffer server(80);

int test_int = 0;
MyStruct myStruct = {0};
setup() {
  // ...
  // generated function that sets up routes to static files
  initializeStaticFilesRequests(&server);
  // Adds GET, POST ArrayBuffer routes on the server listener.
  server.onBuffer("/api/int", "int", (uint8_t*)&test_int, sizeof(test_int) ); 
  server.onBuffer("/api/MyStruct", "MyStruct", (uint8_t*)&myStruct, sizeof(myStruct) ); 
  server.begin();
}
```

## Create some structs and html
```c++ 
// ./models/MyStruct.h
#pragma pack(1) // tells the compiler not to optimize the byte order
struct MyStruct {
  char name[16];
  int value;
};
```
```html
<!-- ./html/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- "/js/models.js" is generated and provides the AsyncBufferAPI class. -->
    <script src="/js/models.js"></script>
  </head>
  <body>
    <h1> Hello Buffer</h1>
    <p>Open the developer tools to inspect the console and network.</p>
    <script>
      // Setup the api
      const api = new AsyncBufferAPI({
        baseUrl: '/api', // prepend all api requests here
        useChecksum: true, // good for rejecting garbage during transmission
        enableDebug: true // console log the network transactions
      });
      const App = async () => {App
        let data, res;
        // get test_int
        [data, res] = await api.get('/int', 'int');
        // modify test_int
        [data, res] = await api.post('/int', 'int', 42);
        // get myStruct
        [data, res] = await api.get('/MyStruct', 'MyStruct');
        data.name = "Buffy";
        data.value = 42;
        // modify myStruct
        [data, res] = await api.post('/MyStruct', 'MyStruct', data);
      }
      App(); // kick off the App
    </script>
  </body>
</html>
```

### Generating Sources
In order to facilitate encoding and decoding on the client we need a way to know how the byte structure on the client. This library has a script that will monitor `./models`, `./html` directories and generate those byte structures and gzip them automatically.

You will need to have node installed and accessible from the terminal.

Using a terminal cd into the root of your project directory and run the following command.
```shell
node ~/Documents/Arduino/libraries/ESP32AsyncBuffer/GenerateSources.js
```
If everything succeeded you should now see in your project directory `dist/_STATIC_HTML_FILES.h`

You can now compile your project and test it out by visiting `http://<ESP32_IP>/` in the browser and then inspecting the dev tools.


# How does it work?
Imagine you have these structs
```cpp
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
  Color colors[3] = {0}; // black
};

Settings settings;
```

### Server receives GET request for a Settings struct:
**Server** `sends binary payload` -> **client** `decodes binary payload into js object`
```js
{
  "ssid": "mySsid",
  "password": "password",
  "mode": 1,
  "version": 1.1,
  "colors": [
    {"r": 0, "g": 0, "b": 0},
    {"r": 0, "g": 0, "b": 0},
    {"r": 0, "g": 0, "b": 0}
  ]
}
```

### Server receives POST request for a Settings struct:
Lets say the user modifies their `ssid`, `password`, `mode` and the `color` at index `0` to something new.

**Client** `encodes settings object and sends binary payload` -> **server** `memcpy the binary data directly into the Settings Structure`
```cpp
Serial.println(settings.ssid);     // "newSsid"
Serial.println(settings.password); // "12345"
Serial.println(settings.mode);     // 6
Color *c = &settings.colors[0];
Serial.printf("r: %d, g: %d, b: %d\n", c->r, c->g, c->b) // r: 255, g: 0, b: 0 ... red :)
```

# Future Plans
- AsyncWebSocketBuffer - websocket support for buffer streams
- AsyncESPNowBuffer - ESPNow support for buffer streams
- Possibly create middleware for new ESPAsyncWeb library.


# License 
