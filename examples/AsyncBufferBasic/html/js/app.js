const App = async () => {
  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let bgc = "#fff";
  let txtc = "#000";
  if(isDarkMode) {
    bgc = "#111"; 
    txtc = "#fff";
  }
  document.documentElement.setAttribute("style", `--main-bg-color:${bgc};--main-text-color:${txtc};`);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', bgc);

  // Setup the api
  const api = new AsyncWebServerBufferAPI({
    baseUrl: '/api', // prepend all api requests here
    useChecksum: true, 
    enableDebug: true // console log the network transactions
  });

  let data, settings, allTypes, res;
  
  // get AllTypes struct
  [allTypes, res] = await api.get('/AllTypes', 'AllTypes');
  // tweak the struct 
  Object.keys(allTypes).forEach(key => {
    allTypes[key] += typeof allTypes[key] == "bigint" ? 10n : 10;
  });
  // modify AllTypes
  [data, res] = await api.post('/AllTypes', 'AllTypes', allTypes);

  // get int
  [data, res] = await api.get('/int', 'int');
  // modify value
  [data, res] = await api.post('/int', 'int', 65000);

  // get value at index
  [data, res] = await api.get('/intArray/9', 'int');
  // modify value at index
  [data, res] = await api.post('/intArray/4', 'int', 65000);

  // get int array
  [data, res] = await api.get('/intArray', 'int');

  // modify post data
  data = data.map((v, index) => {
    return index;
  });
  // modify int array
  [data, res] = await api.post('/intArray', 'int', data);

  // get Settings struct
  [settings, res] = await api.get('/Settings', 'Settings');

  // tweak some Settings
  settings.ssid = "newWiFi";
  settings.password = "newPassword";
  settings.colors.forEach(c => {
    c.r = 255; // hot pink!
    c.g = 25;
    c.b = 127;
  });
  
  // modify Settings struct
  [settings, res] = await api.post('/Settings', 'Settings', settings);
};

// TODO: Add VanJS example 
