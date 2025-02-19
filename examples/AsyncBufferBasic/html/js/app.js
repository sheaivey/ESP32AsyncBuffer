const App = async () => {
  handleDarkMode();

  // Setup the api
  const api = new AsyncWebServerBufferAPI({
    baseUrl: '/api', // prepend all api requests here
    useChecksum: true, 
    enableDebug: true // console log the network transactions
  });

  let data, settings, allTypes, res;
  
  // get AllTypes struct
  [allTypes, res] = await api.get('/AllTypes', 'AllTypes');
  van.add(document.body, await ShowResponse(data, res));
  // tweak the struct 
  Object.keys(allTypes).forEach(key => {
    allTypes[key] += typeof allTypes[key] == "bigint" ? 10n : 10;
  });
  // modify AllTypes
  [data, res] = await api.post('/AllTypes', 'AllTypes', allTypes);
  van.add(document.body, await ShowResponse(data, res));

  // get int
  [data, res] = await api.get('/int', 'int');
  van.add(document.body, await ShowResponse(data, res));
  // modify value
  [data, res] = await api.post('/int', 'int', 65000);
  van.add(document.body, await ShowResponse(data, res));

  // get value at index
  [data, res] = await api.get('/intArray/9', 'int');
  van.add(document.body, await ShowResponse(data, res));
  // modify value at index
  [data, res] = await api.post('/intArray/4', 'int', 65000);
  van.add(document.body, await ShowResponse(data, res));

  // get int array
  [data, res] = await api.get('/intArray', 'int');
  van.add(document.body, await ShowResponse(data, res));

  // modify post data
  data = data.map((v, index) => {
    return index;
  });
  // modify int array
  [data, res] = await api.post('/intArray', 'int', data);
  van.add(document.body, await ShowResponse(data, res));

  // get Settings struct
  [settings, res] = await api.get('/Settings', 'Settings');
  van.add(document.body, await ShowResponse(settings, res));

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
  van.add(document.body, await ShowResponse(settings, res));
};

const handleDarkMode = () => {
  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (isDarkMode) {
    document.documentElement.classList.add("dark");
  }
  const bgc = getComputedStyle(document.documentElement).getPropertyValue('--main-bg-color');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', bgc);
};

// VanJS Compoonents
const { button, span, div, section, p, code, table, thead, tr, th, tbody, td, input, select, textarea, pre, b, a, h1, h2, h3, h4 } = van.tags;

const ShowResponse = async (data, res) => {
  const title = `[${res.method}] ${res.url}`;
  // TODO: add tabs for request and response with raw buffer checkbox
  return p(
    { },
    [
      h3({}, title),
      b({}, `Response: [${res.status}] ${res.statusText} (${res.headers.get("Content-Length") } bytes)`), 
      section( 
        { className: "response" }, 
        ObjectDump({ key: "", value: data })
      )
    ],
  );
}

const ObjectDump = ({ key, value, indent = 0 }) => {
  const localValue = van.state(value);
  const hide = van.state(false);
  const isLeaf = typeof localValue.val !== "object";
  const valueDom = isLeaf ?
    value
    : div(
      { style: () => hide.val ? "display: none;" : "", className: "code" },
      Object.entries(localValue.val).map(([k, v]) =>
        ObjectDump({ key: k, value: v, indent: indent + 2 * (key !== "") })),
    );
  return (key ? div : pre)(
    { className: key ? "line" : ""},
    [" ".repeat(indent),
      key ? (
        isLeaf ? [ "  ", b(`${key}: `)] :
          a({ onclick: () => hide.val = !hide.val, style: "cursor: pointer" },
            () => hide.val ? "+ " : "- ", b(`${key}: `), () => hide.val ? "…" : "",
          )
      ) : [],
      valueDom,
    ]
  );
}