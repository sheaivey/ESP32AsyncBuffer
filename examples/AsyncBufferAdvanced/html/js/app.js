let api;
// Initialize htm with Preact
const {h, render} = preact;
const {useState, useEffect, useRef} = preactHooks;
const html = htm.bind(h);

const begin = () => {
  // Setup the api
  api = new AsyncBufferAPI({
    host: document.getElementsByTagName('base')[0]?.getAttribute('href')?.replace('http://', '') || window.location.host,
    baseUrl: '', // prepend all api requests here
    wsUrl: '/ws', // websocket url
    useChecksum: false,
    enableDebug: true // console log the network transactions
  });
  console.log(api.config);
  
  // start the preact app
  render(html`<${App} />`, document.getElementById('app'));
}


const useStateRef = (defaultValue) => {
  const ref = useRef();
  const [value, setValue] = useState(defaultValue);
  ref.current = value;
  return [ref, (...args) => { 
    setValue(...args);
    return ref.current;
  }];
}

const App = () => {
  const [tab, setTab] = useState('HTTP');
  const handleTab = (e) => {
    setTab(e.target.value);
  };  
  const views = {
    "HTTP": HTTPExplorer, 
    "WebSocket": WSExplorer, 
    "WebSocket Stream": WSStreamExplorer
  };
  return html`
    <div style="margin-top: 24px;">
      <header class="container">
        <h1>
          <img src="img/favicon.png"/>${" "}
          API Explorer!
        </h1>
        <p>
          Use the form below to make request against the ESP32 AsyncBuffer API.
        </p>
        <select onChange=${handleTab} value=${tab}>
          ${Object.keys(views).map((v) => {
            return html`<option key=${v} value=${v} selected=${v == tab}>${v}</option>`;
          })}
        </select>
      </header>
      <${views[tab]} />
    </div>
  `;
};

const HTTPExplorer = () => {
  const [responses, setResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('/api/settings');
  const [type, setType] = useState(null);
  const [data, setData] = useState(null);
  const [invalidData, setInvalidData] = useState(false);
  const  handleRequest = async () => {
    setIsLoading(true);
    let res;
    let start = new Date().getTime();
    try{
      res = await api.fetch(method, url, method === "POST" ? type : null, data);
    }
    catch(e) {
      setIsLoading(false);
      res = [e.message, {ok: false, method: method, url: url, error: e}, type]
    }
    let end = new Date().getTime();
    if(res[1].ok) {
      setType(res[2]);
      setData(res[0]);
    }
    setResponses((responses) => [[...res, end - start], ...responses]);
    setIsLoading(false);
  };
  const handleMethod = (e) => {
    if(e.target.value === 'GET') {
      setType(null);
    }
    setMethod(e.target.value);
  };  
  const handleType = (e) => {
    setData(api.getEmptyType(e.target.value))
    setType(e.target.value);
  };  
  const handleData = (e) => {
    try {
      const d = JSON.parse(e.target.value);
      setData(d);
      setInvalidData(false);
    }
    catch(e) {
      setInvalidData(e.message);
    }
  };

  const handleUrl = (e) => {
    setUrl(e.target.value);
  };
  useEffect(() => {
    handleRequest();
  }, []);
  return html`
  <div class="container">
    <label>
      Method
      <select onChange=${handleMethod} value=${method}>
        ${["GET", "POST"].map((v) => {
          return html`<option key=${v} value=${v} selected=${v == method}>${v}</option>`;
        })}
      </select>
    </label>

    <label>
      URL
      <input onInput=${handleUrl} value=${url} />
    </label>
    ${method !== 'GET' && html`
      <label>
        Data Type
        <select onChange=${handleType} value=${type}>
          ${api.getTypes().map((t) => {
            return html`<option key=${t.name} value=${t.name} selected=${t.name == type}>${t.name}</option>`;
          })}
        </select>
      </label>
      <label>
        Data
        <textarea onInput=${handleData} aria-invalid=${!!invalidData}>${JSON.stringify(data, null, 2)}</textarea>
      </label>
      <div style="color: red;">${invalidData}</div>
    `}
    <button disabled=${isLoading} onClick=${handleRequest}>Send</button>
    <br/>
    <br/>
    ${responses.map(([data, res, type, time], index) => {
      let color = 'rgb(0,255,0)';
      if(!res.ok) {
        color = 'rgb(255,0,0)';
      }
      return html`
        <code style="white-space: pre;width: 100%;margin-bottom: 24px">
          ${responses.length - index}. <b style="color: ${color}">${res.method}</b>: ${res.url}<br/><br/>
          ${type}<br/>
          ${!res.ok ? data : JSON.stringify(data, null, 2)}    
        </code>
      `;
    })}
  </div>
  `;
};

let autoConnect = true;
const WSExplorer = () => {
  const [type, setType] = useState(null);
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [command, setCommand] = useState('settings');
  const [invalidData, setInvalidData] = useState(false);
  const [open, setOpen] = useState(!!api.ws);
  const handleType = (e) => {
    if(e.target.value) {
      setData(api.getEmptyType(e.target.value));
    }
    else {
      setData(null);
    }
    setType(e.target.value || null);
  };  
  const handleData = (e) => {
    try {
      const d = JSON.parse(e.target.value);
      setData(d);
      setInvalidData(false);
    }
    catch(e) {
      setInvalidData(e.message);
    }
  };
  const handleCommand = (e) => {
    setCommand(e.target.value);
  };
  const handleAutoConnect = (e) => {
    autoConnect = e.target.checked;
  }

  const handleRequest = () => {
    setMessages((messages) => [ { e: {timeStamp: performance.now()}, command, type, data: JSON.stringify(data, null, 2), direction: 'send' }, ...messages ] );
    api.send(command, type, data);
  }

  useEffect(() => {
    api.on('*', async (e, command, type, data) => {
      setCommand(c => {
        if(c === command) {
          if(type) {
            setType(type);
          }
          if(data) {
            setInvalidData(false);
            setData(data);
          }
        }
        return c;
      });
      setMessages((messages) => [ { e, command, type, data: JSON.stringify(data, null, 2), direction: 'receive' }, ...messages ] ) 
    });
    api.on('open', (e) => { 
      setOpen(true);
      setMessages((messages) => [ { e, command: 'open', type: null, data: null, direction: 'event' }, ...messages ] ) 
    });
    api.on('close', (e) => { 
      setOpen(false);
      if(autoConnect){
        setTimeout(() => api.open(), 100); // attempt to reconnect
      }
      setMessages((messages) => [ { e, command: 'close', type: null, data: null, direction: 'event' }, ...messages ] );
    });
    api.on('error', (e) => { setMessages((messages) => [ { e, command: 'error', type: null, data: null, direction: 'event' }, ...messages ] ) });
    if(autoConnect){
      api.open();
    }
    return () => {
      api.close();
    }
  }, []);
  return html`
  <div class="container">
    <label>
      Command
      <input onInput=${handleCommand} value=${command} placeholder="Command" />
    </label>
    <label>
      Data Type
      <select onChange=${handleType} value=${type} placeholder="Data Type">
        <option value=${null} selected=${null == type}> </option>
        ${api.getTypes().map((t) => {
          return html`<option key=${t.name} value=${t.name} selected=${t.name == type}>${t.name}</option>`;
        })}
      </select>
    </label>
    ${type !== null ? html`<label>Data<textarea placeholder="Data" onInput=${handleData} aria-invalid=${!!invalidData}>${JSON.stringify(data, null, 2)}</textarea></label>` : ''}
    <div style="color: red;">${invalidData}</div>
    <div class="grid">
    <div>
      <button onClick=${handleRequest}>Send</button>
    </div>
    <div style="text-align: right">
      <input type="checkbox" onInput=${handleAutoConnect} checked=${autoConnect} title="Auto Reconnect" role="switch" />
      <b style="color: ${open ? "rgba(0,255,0)" : "rgba(255,0,0)"}">${open ? "Connected" : "Disconnected"}</b>
    </div>
  </div>
    <br/><br/>
    <code style="white-space: pre;width: 100%;margin-bottom: 24px">
    ${messages.map(({e, command, type, data, direction}, index ) => {
      let color = 'rgb(0,200,255)';
      if(command === 'error') {
        color = 'rgb(255,0,0)';
      }
      if(command === 'open') {
        color = 'rgb(0,255,0)';
      }
      if(command === 'close') {
        color = 'rgb(255,200,0)';
      }
      const hasData = data && type;
      const tick = e.timeStamp;
      return html`
        <div style="margin-bottom: 24px">
          ${messages.length - index}. <b style="color: ${color}">${command}</b> (${direction})
          ${typeof hasData ? html`<br/><br/>${type}<br/>${ data === "object" ? JSON.stringify(data, null, 2) : data || ''}` : ''}
          <hr/>
        </div>
      `;
    })}
    </code>
  </div>
`;
}

const WSStreamExplorer = () => {
  const [data, setData] = useState({});
  const [fpsRef, setFps] = useStateRef(1);
  const [err, setErr] = useState(false);
  const [disconnectCount, setDisconnectCount] = useState(0);
  const [open, setOpen] = useState(!!api.ws);
  const handleFps = (e) => {
    const v = parseInt(e.target.value, 10);
    api.send("fps", "uint8_t", v);
    setFps(v);
  };
  const handleStart = () => {
    api.send("stream", "uint8_t", fpsRef.current);
  }
  const handleStop = () => {
    api.send("stream", "uint8_t", 0);
  }  
  const handleClose = () => {
    api.send("close");
  }
  const handleAutoConnect = (e) => {
    autoConnect = e.target.checked;
  }

  useEffect(() => {
    api.on('data', async (e, command, type, data) => {
      setData((d) => ({ e, command, type, data: JSON.stringify(data, null, 2), direction: 'receive' }) ) 
    });
    api.on('close', async (e, command, type, data) => {
      setDisconnectCount((v) => ++v);
      setOpen(false);
      if(autoConnect){
        setTimeout(() => {
          api.send("stream", "uint8_t", fpsRef.current); // restart the stream
        }, 100); // try to reconnect
      }
    });
    api.on('open', async (e, command, type, data) => {
      setOpen(true);
    });
    api.on('error', async (e, command, type, data) => {
      setErr(JSON.stringify(data, null, 2));
    });
    if(autoConnect){
      api.open();
    }
    return () => {
      api.close();
    }
  },[]);
  return html`
  <div class="container">
    <label>
      FPS <div style="float: right">${fpsRef.current}</div>
      <input type="range" min="1" max="127" step="1" onInput=${handleFps} defaultValue=${fpsRef.current} />
    </label>
    <div class="grid">
      <div role="group">
        <button onClick=${handleStart} class="primary">Start</button>
        <button onClick=${handleStop} class="secondary">Stop</button>
        <button onClick=${handleClose} class="secondary">Close</button>
      </div>
      <div style="text-align: right">
        <input type="checkbox" onInput=${handleAutoConnect} checked=${autoConnect} title="Auto Reconnect" role="switch" />
        <b style="color: ${open ? "rgba(0,255,0)" : "rgba(255,0,0)"}">${open ? "Connected" : "Disconnected"}</b>
      </div>
    </div>
    <b style="color: rgba(255,0,0)">${err}</b>
    <br/>
    <br/>
    <code style="white-space: pre;width: 100%;margin-bottom: 24px">
      ${data.type}<br />
      ${data.data}
    </code>
    Disconnects: ${disconnectCount}
  </div>`;
}