/*  AsyncBufferAPI
    By: Shea Ivey
    Version: 1.0.0_BETA
    [ key, { i=id, s=byte size, m=buffer conversion method, p=primitive } ], // Primitive type format
    [ key, {  // Struct type format
      id: 1,
      name: "structName",
      primitive: false,
      fields: [ 
        { 
          type: "", // primitive type or struct type
          name: "",  // parameter name
          arraySize: 0, // array size
          value: 0 // default value
        }
      ] 
    }, ... ],
*/
class AsyncBufferAPI {
  #typeHeader = "X-Type";
  #checksumHeader = "X-Checksum";
  #idIndex = 0;
  #primitiveTypes = {
    "bool": { s: 1, m: "Uint", p: true },
    "char": { s: 1, m: "Int", p: true },
    "unsigned char": { s: 1, m: "Uint", p: true },
    "int8_t": { s: 1, m: "Int", p: true },
    "uint8_t": { s: 1, m: "Uint", p: true },
    "short": { s: 2, m: "Int", p: true },
    "unsigned short": { s: 2, m: "Uint", p: true },
    "int16_t": { s: 2, m: "Int", p: true },
    "uint16_t": { s: 2, m: "Uint", p: true },
    "int": { s: 4, m: "Int", p: true },
    "unsigned int": { s: 4, m: "Uint", p: true },
    "long": { s: 4, m: "Int", p: true },
    "unsigned long": { s: 4, m: "Uint", p: true },
    "int32_t": { s: 4, m: "Int", p: true },
    "uint32_t": { s: 4, m: "Uint", p: true },
    "size_t": { s: 4, m: "Int", p: true },
    "float": { s: 4, m: "Float", p: true },
    "double": { s: 8, m: "Float", p: true },
    "long long": { s: 8, m: "BigInt", p: true },
    "unsigned long long": { s: 8, m: "BigUint", p: true },
    "int64_t": { s: 8, m: "BigInt", p: true },
    "uint64_t": { s: 8, m: "BigUint", p: true },
  };
  #_types = new Map();
  #_typesByString = new Map();

  constructor(config = {}) {
    this.config = { 
      host: typeof location === "object" ? location.host : '', 
      baseUrl: '',
      wsUrl: '/ws', 
      useChecksum: false, 
      enableDebug: false, 
      ...config 
    };
    this.addType(this.#primitiveTypes);
    if (typeof _structs == "object") {
      this.addType(_structs);
    }
  }

  // Fetch API section
  async fetch(method = "GET", url, type = null, data = null, options = {}) {
    const _options = { method, headers: {}, ...options};
    if(type !== null) {
      type = this.getType(type);
      _options.headers[this.#typeHeader] = type.id;
    }
    if (method != "GET") {      
      _options.body = this.encode(type?.id || null, data || 0);
      _options.bodyDecoded = data;
      _options.headers["Content-Type"] = "text/plain";
      if (this.config.useChecksum) {
        _options.headers[this.#checksumHeader] = this.#computeChecksum(new Uint8Array(_options.body)).toString();
      }
    }
    else {
      if (this.config.useChecksum) {
        _options.headers[this.#checksumHeader] = "";
      }
    }
    let output = null;
    const response = await fetch(`${this.config.baseUrl}${url}`, _options);
    response.method = method;
    response.request = { method, url, type: type?.name || null, data, options };
    if (!response.ok) {
      output = await response.text();
      return [output, response, type?.name || null];
    }
    if(response.headers.get("Content-Type") === 'application/octet-stream' && response.headers.has(this.#typeHeader)) {
      const buffer = await response.arrayBuffer();
      if(response.headers.has(this.#checksumHeader)) {
        const computedChecksum = this.#computeChecksum(new Uint8Array(buffer)).toString();
        const responseChecksum = response.headers.get(this.#checksumHeader);
        if (this.config.useChecksum && responseChecksum != computedChecksum) {          
          throw new Error('Checksum failed!');
        }
      }
      type = this.getType(response.headers.get(this.#typeHeader));
      output = this.decode(type.id, buffer);
    }
    else {
      output = await response.text();
    }
    response.bodyDecoded = output;
    if(this.config.enableDebug) {
      console.log(`${_options.method}: ${this.config.baseUrl}${url}`, response);
    }
    return [output, response, type?.name || null];
  }
  async get(url, type = null, options = {}) { return await this.fetch('GET', url, type, null, options); };
  async put(url, type, data = null, options = {}) { return await this.fetch('PUT', url, type, data, options); };
  async post(url, type, data = null, options = {}) { return await this.fetch('POST', url, type, data, options); };
  async delete(url, type, data = null, options = {}) { return await this.fetch('DELETE', url, type, data, options); };

  // // WebSockets API section
  ws = null;
  #wsCommand = new Map();
  // register event listener on path
  on(command, cb) {
    this.#wsCommand.set(command, cb);
  }
  // send message on path
  send(command, type = null, data = null, retry = 3) {
    this.open(); // make sure the connection is open.
    if(api.ws.readyState !== 1 && retry) {
      setTimeout(() => this.send(command, type, data, retry-1), 100);
      return;
    }
    const encoder = new TextEncoder();
    let header = `${command};`; // command
    let body = new Uint8Array(0);
    let typeInfo = null;
    if(type !== null && data !== null) {
      typeInfo = this.getType(type);
      header += `${typeInfo.id};`; // type
      body = new Uint8Array(this.encode(type, data)); // encoded body
    }
    else {
      header += ';'; // no type or body
    }
    header = encoder.encode(header);
    let buffer = new Uint8Array(header.length + body.length);
    buffer.set(header, 0);
    buffer.set(body, header.length);
    this.ws.send(buffer.buffer);
    if(this.config.enableDebug) {
      console.log(`ws send: ${command} ${typeInfo ? `<${typeInfo.name}>` : ""}`, data);
    }
  }
  // close the websocket
  close() {
    if(!this.ws || this.ws.readyState === 3) return; // already closed
    this.ws.close();
    this.ws = null;
  }
  // open the websocket
  open() {
    if(this.ws && this.ws.readyState != 3) return; // already initialized
    this.ws = new WebSocket(`ws://${this.config.host}${this.config.wsUrl}`);
    this.ws.addEventListener("open", (e) => {
      const cb = this.#wsCommand.get('open');
      cb && cb(e);
      if(this.config.enableDebug) {
        console.log(`ws opened:`, e);
      }
    });
    this.ws.addEventListener("error", (e) => {
      const cb = this.#wsCommand.get('error');
      cb && cb(e);
      if(this.config.enableDebug) {
        console.log(`ws error:`, e);
      }
    });

    this.ws.addEventListener("close", (e) => {
      const cb = this.#wsCommand.get('close');
      cb && cb(e);
      if(this.config.enableDebug) {
        console.log(`ws closed:`, e);
      }
      this.ws = null;
    });
    this.ws.addEventListener("message", async (e) => {
      let command = null, type = null, body = null;
      if(e.data instanceof Blob) {
        const arrayBuffer = await e.data.arrayBuffer();          
        const buffer = new Uint8Array(arrayBuffer);
        if(buffer.byteLength <= 2){
          return; // empty command
        }
        let hIdx = 0;
        let header = ["",""];
        for(let i = 0; i < buffer.byteLength; i++) {
          let c = String.fromCharCode(buffer[i])
          if(hIdx == 2) {
            break; // all done
          }
          if(c == ';') {
            hIdx++;
            continue; // start next header
          }
          header[hIdx] += c;
        }
        [command, type] = header;
        let bodyOffset = command.length + type.length + hIdx;
        body = buffer.slice(bodyOffset);
        body = api.decode(type, body.buffer);
        type = this.getType(type).name;
      }
      let cb = this.#wsCommand.get('*');
      cb && cb(e, command, type, body);
      cb = this.#wsCommand.get(command);
      cb && cb(e, command, type, body);
      if(this.config.enableDebug) {
        console.log(`ws receive: ${command} <${type}>`, body);
      }
    });
  }

  addType(type, structDefinition) {
    if (this.#_types.has(type)) {
      throw new Error(`Type already defined '${type}'`);
    }
    if (typeof type === "object") {
      const typesAdded = [];
      Object.keys(type).forEach((key) => {
        typesAdded.push(this.addType(key, type[key]));
      });
      return typesAdded;
    }
    let newDef = structDefinition;
    if (structDefinition.s) {
      // inflate typeInfo
      const bits = structDefinition.s * 8;
      newDef = {
        size: structDefinition.s,
        primitive: structDefinition.p
      };
      if (newDef.primitive) {
        newDef.readMethod = `get${structDefinition.m}${bits}`;
        newDef.writeMethod = `set${structDefinition.m}${bits}`;
      }
    }
    const info = { id: this.#idIndex++, primitive: false, name: type, ...newDef };
    this.#_typesByString.set(type, info.id);
    this.#_types.set(info.id, info);
    return info;
  }

  getTypes() {
    return Array.from(this.#_types, ([name, value]) => ({ name, ...value }));
  }

  getType(type, error = true) {
    if (typeof type === "string") {
      // lookup type by name
      if(!isNaN(type)) {
        type = parseInt(type, 10);
      }
      else {
        if (!this.#_typesByString.has(type)) {
          if (error) {
            throw new Error(`Decoding unknown type string '${type}'`);
          }
          return null;
        }
        type = this.#_typesByString.get(type);
      }
    }
    if(typeof type === "object" && type.name) {
      // already a type info object
      return type;
    }
    if (!this.#_types.has(type)) {
      // lookup type by enum id
      if (error) {
        throw new Error(`Decoding unknown type id '${type}'`);
      }
      return null;
    }
    return this.#_types.get(type);
  }

  getEmptyType(type) {
    const typeInfo = this.getType(type);
    if (typeInfo.primitive) {
      const v = this.#decodeClientType(type, 0);
      return v;
    }
    let fields = typeInfo.fields;
    let obj = {};
    for (const { type, name, value, arraySize } of fields) {
      const v = value !== undefined ? value : this.getEmptyType(type);
      if (arraySize && type != 'char') {
        obj[name] = Array.from({ length: arraySize }, () => v);
      }
      else {
        obj[name] = v;
      }
    };
    return obj;
  }

  decode(type, buffer) {
    const typeInfo = this.getType(type);

    if (!typeInfo) {
      throw new Error(`Decoding unknown type '${type}'`);
    }
    let fields = [];
    if (typeInfo.primitive) {
      // primitive data type
      fields = [{ type, name: 'value' }];
      if (buffer.byteLength > typeInfo.size) {
        if (buffer.byteLength % typeInfo.size !== 0) {
          throw new Error("Invalid array buffer size for type.",);
        }
        fields[0].arraySize = buffer.byteLength / typeInfo.size;
      }
    }
    else {
      //struct data type
      fields = typeInfo.fields;
    }
    let view = new DataView(buffer);
    let offset = 0;
    let obj = {}; //{ _structure: type };
    fields.forEach(({ type, name, arraySize }) => {
      const typeInfo = this.getType(type);
      if (arraySize) {
        obj[name] = [];
        for (let i = 0; i < arraySize; i++) {
          offset = this.#generateDecoding(buffer, view, offset, obj, type, name, true);
        }
        if (typeInfo.name === 'char') { 
          obj[name] = obj[name].join('');
        }
      } else {
        offset = this.#generateDecoding(buffer, view, offset, obj, type, name);
      }
    });

    if (typeInfo.primitive) {
      // extract the primitive value.
      return obj.value;
    }

    return obj;
  }
  // generateDecoding helper
  #generateDecoding(buffer, view, offset, obj, type, varName, isArray = false) {
    const typeInfo = this.getType(type);
    if (typeInfo.primitive) {
      let method = typeInfo.readMethod;
      let value = this.#decodeClientType(type, view[method](offset, true));
      if (isArray) {
        obj[varName].push(value);
      }
      else {
        obj[varName] = value;
      }
      offset += typeInfo.size;
    } else {
      let subBuffer = buffer.slice(offset, offset + this.#calculateSize(this.getType(type).fields));
      const value = this.decode(type, subBuffer);
      if (isArray) {
        obj[varName].push(value);
      }
      else {
        obj[varName] = value;
      }
      offset += subBuffer.byteLength;
    }
    return offset;
  }

  encode(type, data) {
    let fields = [];
    const typeInfo = this.getType(type);
    if (typeInfo.primitive) {
      // primitive data type
      fields = [{ type, name: 'value' }];
      if (Array.isArray(data)) {
        fields[0].arraySize = data.length;
      }
      data = { value: data };
    }
    else {
      //struct data type
      fields = this.getType(type).fields;
    }

    let buffer = new ArrayBuffer(this.#calculateSize(fields));
    let view = new DataView(buffer);
    let offset = 0;
    fields.forEach(({ type, name, arraySize }) => { // body
      if (arraySize) {
        for (let i = 0; i < arraySize; i++) {
          offset = this.#generateEncoding(buffer, view, offset, type, data[name][i], true);
        }
      } else {
        offset = this.#generateEncoding(buffer, view, offset, type, data[name]);
      }
    });
    return buffer;
  }

  // generateEncoding helper
  #generateEncoding(buffer, view, offset, type, value) {
    const typeInfo = this.getType(type);
    if (typeInfo.primitive) {
      let method = typeInfo.writeMethod;
      view[method](offset, this.#encodeClientType(type, value), true);
      offset += typeInfo.size;
    } else {
      let subBuffer = this.encode(type, value);
      new Uint8Array(buffer).set(new Uint8Array(subBuffer), offset);
      offset += subBuffer.byteLength;
    }
    return offset;
  }

  // encodeClientType
  #encodeClientType(type, value) {
    if (value === undefined) {
      return value;
    }
    const typeInfo = this.getType(type);
    switch (typeInfo.name) {
      case "float":
        return parseFloat(value.toFixed(6)); // round to 32 bit float precision
      case "bool":
        return value ? 1 : 0;
      case "char":
        return value.charCodeAt(0);
      default:
        return value;
    }
  };
  // decodeClientType
  #decodeClientType(type, value) {
    if (value === undefined) {
      return value;
    }
    const typeInfo = this.getType(type);
    switch (typeInfo.name) {
      case "float":
        return parseFloat(value.toFixed(6)); // round to 32 bit float precision
      case "bool":
        return !!value;
      case "char":
        if (value === 0) {
          return '';
        }
        return String.fromCharCode(value);
      default:
        return value;
    }
  };

  // calculateSize struct size
  #calculateSize(fields = []) {
    return fields.reduce((size, { type, arraySize }) => {
      let typeSize = this.getType(type).size || this.#calculateSize(this.getType(type).fields);
      return size + (arraySize ? typeSize * arraySize : typeSize);
    }, 0);
  }

  #computeChecksum(data) {
    if (this.config.useChecksum === false) {
      return 0xffff;
    }
    let sum1 = 0;
    let sum2 = 0;
    for (let byte of data) {
      sum1 = (sum1 + byte) % 255;
      sum2 = (sum2 + sum1) % 255;
    }
    return (sum2 << 8) | sum1;
  }
}
// so we can use this with require
typeof module === "object" ? module.exports = AsyncBufferAPI : null;
