# <img src="html/img/favicon.png" width="32" height="32" alt="ESP32AsyncBuffer" style="vertical-align: top" /> ESP32AsyncBuffer Advanced Example 

This example shows an advanced single page app using ESP32AsyncBuffer and
demonstrating a simple API Explorer with websocket commands and data streams.
It is also shows use of large `css` file and using a javascript framework like `PreactJS`.

## Generate Sources
You will first need to run the node script to generate the static HTML files.
```shell
# From your project root
node ~/Documents/Arduino/libraries/ESP32AsyncBuffer/GenerateSources.js
```

Be sure to update the `ssid` and `password` to connect your local network.

Now you can build and upload this example.
