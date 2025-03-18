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
    <div style="padding: 24px;">
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
      res = await api.fetch(method, url, type, data);
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
  <div>
    <select onChange=${handleMethod} value=${method}>
      ${["GET", "POST"].map((v) => {
        return html`<option key=${v} value=${v} selected=${v == method}>${v}</option>`;
      })}
    </select>
    <input onInput=${handleUrl} value=${url} />
    ${method !== 'GET' && html`
      <select onChange=${handleType} value=${type}>
        ${api.getTypes().map((t) => {
          return html`<option key=${t.name} value=${t.name} selected=${t.name == type}>${t.name}</option>`;
        })}
      </select>
      <textarea onInput=${handleData} value=${JSON.stringify(data, null, 2)}></textarea>
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

const WSExplorer = () => {
  const [type, setType] = useState(null);
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [command, setCommand] = useState('settings');
  const [invalidData, setInvalidData] = useState(false);
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
            setData(data);
          }
        }
        return c;
      });
      
      setMessages((messages) => [ { e, command, type, data: JSON.stringify(data, null, 2), direction: 'receive' }, ...messages ] ) 
    });
    api.on('open', (e) => { setMessages((messages) => [ { e, command: 'open', type: null, data: null, direction: 'event' }, ...messages ] ) });
    api.on('close', (e) => { setMessages((messages) => [ { e, command: 'close', type: null, data: null, direction: 'event' }, ...messages ] ) });
    api.on('error', (e) => { setMessages((messages) => [ { e, command: 'error', type: null, data: null, direction: 'event' }, ...messages ] ) });
    api.open();
    return () => {
      api.close();
    }
  }, []);
  return html`
  <div>
    <input onInput=${handleCommand} value=${command} />
    <select onChange=${handleType} value=${type} placeholder="Command">
      <option value=${null} selected=${null == type}> </option>
      ${api.getTypes().map((t) => {
        return html`<option key=${t.name} value=${t.name} selected=${t.name == type}>${t.name}</option>`;
      })}
    </select>
    ${type !== null ? html`<textarea onInput=${handleData} value=${JSON.stringify(data, null, 2)}></textarea>` : ''}
    <div style="color: red;">${invalidData}</div>
    <button onClick=${handleRequest}>Send</button>
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
  const [fps, setFps] = useState(1);
  api.on('data', async (e, command, type, data) => {
    setData((d) => ({ e, command, type, data: JSON.stringify(data, null, 2), direction: 'receive' }) ) 
  });
  const handleFps = (e) => {
    const v = parseInt(e.target.value, 10);
    api.send("fps", "uint8_t", v);
    setFps(v);
  };
  const handleStart = () => {
    api.send("stream", "uint8_t", fps);
  }
  const handleStop = () => {
    api.send("stream", "uint8_t", 0);
  }

  useEffect(() => {
    api.open();
    return () => {
      api.close();
    }
  },[]);
  return html`
  <input type="range" min="1" max="120" step="1" onInput=${handleFps} value=${fps} />
  <button onClick=${handleStart}>Start</button>${" "}
  <button onClick=${handleStop}>Stop</button><br/><br/>
  <code style="white-space: pre;width: 100%;margin-bottom: 24px">
    ${data.type}<br />
    ${data.data}
  </code>`;
}