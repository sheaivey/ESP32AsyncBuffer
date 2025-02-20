let api;

const App = async () => {
  handleDarkMode();  
  // Setup the api
  api = new AsyncWebServerBufferAPI({
    baseUrl: '/api', // prepend all api requests here
    useChecksum: true, 
    enableDebug: true // console log the network transactions
  });

  van.add(document.body, ApiTester());

  


  // let data, res;
  
  // // get AllTypes struct
  // [data, res] = await api.get('/AllTypes', 'AllTypes');
  // // tweak the struct 
  // Object.keys(data).forEach(key => {
  //   data[key] += typeof data[key] == "bigint" ? 10n : 10;
  // });
  // // modify AllTypes
  // [data, res] = await api.post('/AllTypes', 'AllTypes', data);

  // // get int
  // [data, res] = await api.get('/int', 'int');
  // // modify value
  // [data, res] = await api.post('/int', 'int', 65000);

  // // get value at index
  // [data, res] = await api.get('/intArray/9', 'int');
  // // modify value at index
  // [data, res] = await api.post('/intArray/4', 'int', 65000);

  // // get int array
  // [data, res] = await api.get('/intArray', 'int');

  // // modify post data
  // data = data.map((v, index) => {
  //   return index;
  // });
  // // modify int array
  // [data, res] = await api.post('/intArray', 'int', data);

  // // get Settings struct
  // [data, res] = await api.get('/Settings', 'Settings');

  // // tweak some Settings
  // data.ssid = "newWiFi";
  // data.password = "newPassword";
  // data.colors.forEach(c => {
  //   c.r = 255; // hot pink!
  //   c.g = 25;
  //   c.b = 127;
  // });
  
  // // modify Settings struct
  // [data, res] = await api.post('/Settings', 'Settings', data);
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const Run = ({sleepMs}) => {
  const steps = van.state(0)
  ;(async () => { for (; steps.val < 40; ++steps.val) await sleep(sleepMs) })()
  return pre(() => `${" ".repeat(40 - steps.val)}🚐💨Hello VanJS!${"_".repeat(steps.val)}`)
}

const ApiTester = () => {
  const loading = van.state(false);
  const url = van.state('/Settings');
  const method = van.state('POST');
  const type = van.state('Settings');
  const payload = van.state(api.getEmptyType(type.val));
  const results = van.state([null, null]);
  (async () => {
    loading.val = true; 
    //results.val = await api.fetch(method.val, url.val, type.val, payload.val);
    await sleep(1000);
    loading.val = false;
  })();
  console.log(loading.val, results.val);

  return p(
    { },
    [
      h3({}, "API Tester"),
      loading.val ? "loading..." : "",
      div({className: ""}, 
        input({})
      ),
      ShowResponse(results),
      Run({sleepMs: 500})
    ],
  );
}



const ShowResponse = (data, res) => {
  if(res == null || data == null) {
    return null;
  }
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