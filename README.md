# <img src="examples/AsyncBufferBasic/html/img/favicon.png" width="32" height="32" alt="ESP32AsyncBuffer" style="vertical-align: top" /> ESP32AsyncBuffer  

This library provides a solution to efficiently **send and receive binary data structures** between an ESP32 and a client. It includes **encoding and decoding helper functions**, allowing easy data manipulation with minimal overhead.  

---

## **Why use this library?**  

Using **JSON** to transfer structured data between a client and an embedded system is inefficient:  
- **Memory usage**: JSON encoding/decoding is expensive on microcontrollers.  
- **Processing time**: Parsing JSON adds unnecessary delays.  
- **Payload size**: JSON introduces **extra characters (fluff)**, increasing data size.  

### **Key Idea**  
Instead of JSON, **let the client handle encoding/decoding** while the **ESP32 works directly with binary data**. This results in **smaller, faster, and more efficient communication**.

With all the features and bonus features building embedded single page apps has never been easier.

---

## **Core Features**  
✅ **Extremely fast send/receive times**: binary instead of JSON  
✅ **Minimal payload sizes**: (decoded on the client into JavaScript object)  
✅ **Supports nested structures**: (structs within structs)  
✅ **Uses minimal dynamic memory**: (`memcpy()` directly into variables)  
✅ **Handles very large datasets**: efficiently  
✅ **Checksum support**: for integrity verification  
✅ **Lightweight client decoder**: `js/models.js`
### Bonus Features!! 😻  
✅ **Automatic source generation**: Watches `./models` and `./html` for changes  
✅ **GZIP support**: Store and serve compressed static files for **faster static file responses** 🚀  
✅ **Cache Control**: `Etag` `If-None-Match` `304 Not Modified` for static files 🚀    

---

## **Installation**  

> ⚠️ This is a simplified setup. Check `./examples/AsyncBufferBasic` for a complete example.  

### **1️⃣ Install the Library**  
Clone or copy this repository into your Arduino libraries folder:  

```shell
git clone https://github.com/your-repo/ESP32AsyncBuffer.git ~/Documents/Arduino/libraries/ESP32AsyncBuffer
```

### **2️⃣ Include the Library and Set Up a Server**  
```cpp
// ./MyProject.ino
#include "dist/_GENERATED_SOURCE.h" // include Auto-generated before AsyncWebServerBuffer.h
#include "AsyncWebServerBuffer.h"
#include "models/MyStruct.h"

AsyncWebServerBuffer server(80);

int test_int = 0;
MyStruct myStruct = {0};

void setup() {

  // Add GET and POST handlers for binary data
  server.onBuffer("/api/int", "int", (uint8_t*)&test_int, sizeof(test_int)); 
  server.onBuffer("/api/MyStruct", "MyStruct", (uint8_t*)&myStruct, sizeof(myStruct)); 

  server.begin();
}
```

---

## **3️⃣ Define Your Data Structures**  
Create a struct in **C++**:  
```cpp
// ./models/MyStruct.h
#pragma pack(1) // Ensures correct byte alignment
struct MyStruct {
  char name[16];
  int value;
};
```

---

### **4️⃣ Create the Web Interface**
```html
<!-- ./html/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <script src="/js/models.js"></script> <!-- Auto generated static file -->
  </head>
  <body>
    <h1>Hello Buffer</h1>
    <p>Open the developer tools to inspect the console and network.</p>
    <script>
      // Initialize API
      const api = new AsyncBufferAPI({
        baseUrl: '/api',
        useChecksum: true,  // Reject corrupted data
        enableDebug: true   // Log network transactions
      });

      const App = async () => {
        let data, res;

        // Read and modify an integer
        [data, res] = await api.get('/int', 'int');
        [data, res] = await api.post('/int', 'int', 42);

        // Read and modify a struct
        [data, res] = await api.get('/MyStruct', 'MyStruct');
        data.name = "Buffy";
        data.value = 42;
        [data, res] = await api.post('/MyStruct', 'MyStruct', data);
      };

      App(); // Run
    </script>
  </body>
</html>
```

---

## **5️⃣ Generating Sources**  

The packing script **monitors `./models` and `./html`**, and will automatically regenerate required sources.

* Any `.h` `.cpp` files found in `./models` will get scanned for structs and generate info for decoding on the client.
* All files found in `./html` will attempt to be minified and gzipped and routes will get created for serving each static file. All requests will also have caching with an etag and max-age validation for quicker responses.
* Have a look at the following lightweight UI frameworks for creating reactive single page apps.
  * [VanJS](https://vanjs.org) For those who think every byte matters `(~1.04KB gzipped)`
  * [Preact](https://preactjs.com) For those familiar with react `(~5.19KB gzipped)`
  * [El](https://github.com/frameable/el) For those looking for class based components `(~2.16KB gzipped)` 

### **Run the packing script:**

From the `root of your .ino project` run the `GenerateSources.js` script found in ESP32AsyncBuffer library.

> ⚠️ You will need **node** `v20.10.0` or better to run the following script.
> You may need to give **node** access to modify files on your system.

```shell
# From your project root
node ~/Documents/Arduino/libraries/ESP32AsyncBuffer/GenerateSources.js
```
> If successful, two new files will appear in your project.
```shell
./dist/_GENERATED_SOURCE.h  # All the static source files neatly bundled up 
./GenerateSource.json  # Ability to change bundling settings.
```
> Setting Options for generating sources. Useful for debugging
```js
{
  "modelsDir": "/models", // watch for struct changes here
  "htmlDir": "/html", // watch for static html files changes here
  "outputFile": "/dist/_GENERATED_SOURCE.h",
  "useChecksum": true, // enable checksum on the server
  "minify": true, // minify the static files in `htmlDir`
  "inline": false, // in html files inline css,js,img where possible
  "gzip": true, // store and serve gzip files
  "outputSources": true // also output the static minified/gzipped files to ./dist
}
```


### **Test Your Setup**  
1. **Compile and upload your sketch**  
2. **Visit** `http://<ESP32_IP>/` in your browser  
3. **Open Developer Tools** (F12) to inspect network activity  

---

## **How It Works**  

### **Example: Handling Structs**  
Consider the following **C++ structures**:  
```cpp
#pragma pack(1)
struct Color {
  uint8_t r, g, b;
};

#pragma pack(1)
struct Settings {
  char ssid[16] = "mySsid";
  char password[16] = "password";
  uint8_t mode = 1;
  float version = 1.1;
  Color colors[3] = {0}; // Array of 3 colors (default: black)
};

Settings settings;
```

### **📡 GET Request: Fetch Struct Data**  
- **Server** → Sends **binary payload** directly from the settings struct.
- **Client** → **Validates & Decodes** into a JavaScript object.
```js
{
  "ssid": "mySsid",
  "password": "password",
  "mode": 1,
  "version": 1.1,
  "colors": [
    { "r": 0, "g": 0, "b": 0 },
    { "r": 0, "g": 0, "b": 0 },
    { "r": 0, "g": 0, "b": 0 }
  ]
}
```

### **📡 POST Request: Update Struct Data**  
Pretend the user modifies the received data via some UI input controls and presses the **save button**. 
- **Client** → **Encodes and sends binary payload**
- **Server** → **Validates & Directly copies** the received bytes into the settings struct.
```cpp
Serial.println(settings.ssid);     // "newSsid"
Serial.println(settings.password); // "12345"
Serial.println(settings.mode);     // 6

Color *c = &settings.colors[0];
Serial.printf("r: %d, g: %d, b: %d\n", c->r, c->g, c->b); // r: 255, g: 0, b: 0
```

---

## **Future Plans 🚀**  
- **WebSockets Support** (`AsyncWebSocketBuffer`)  
- **ESP-NOW Support** (`AsyncESPNowBuffer`)  
- **More examples and integrations** 
  - Boilerplate app using Preact with captive portal and wifi setup.
  - Websocket data streaming
  - ESP Now data streaming

---

## **License**  
This project is licensed under **MIT License**. 