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
      this.config = {baseUrl: '/', useChecksum: false, enableDebug: false, ...config};
      this.addType(this.#primitiveTypes);
      if(typeof _structs == "object") {
        this.addType(_structs);
      }
  }

  addType(type, structDefinition) {
    if(this.#_types.has(type)) {
      throw new Error(`Type already defined '${type}'`);
    }
    if(typeof type === "object") {
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
    if(typeof type === "string") {
      // lookup type by name
      if(!this.#_typesByString.has(type)) {
        if (error) {
          throw new Error(`Decoding unknown type string '${type}'`);
        }
        return null;
      }
      type = this.#_typesByString.get(type);
    }
    if(!this.#_types.has(type)) {
      // lookup type by enum id
      if (error) {
        throw new Error(`Decoding unknown type id '${type}'`);
      }
      return null;
    }
    return this.#_types.get(type);
  }

  async fetch(method = "GET", url, type = null, data = null, options = {}) {
      const _options = { method, headers: {}, ...options};
      if(type !== null) {
        _options.headers[this.#typeHeader] = type;
      }
      if (method != "GET") {      
        _options.body = this.encode(type, data || 0);
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
      const response = await fetch(`${this.config.baseUrl}${url}`, _options);
      response.method = method;
      response.request = { method, url, type, data, options };
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      let output = null;
      if(response.headers.get("Content-Type") === 'application/octet-stream' && response.headers.has(this.#typeHeader)) {
        const buffer = await response.arrayBuffer();
        const computedChecksum = this.#computeChecksum(new Uint8Array(buffer)).toString();
        const responseChecksum = response.headers.get(this.#checksumHeader);
        if (this.config.useChecksum && responseChecksum != computedChecksum) {
          // TODO: could automatically retry until success or n number of failed attempts.
          throw new Error('Checksum failed!');
        }
        output = this.decode(response.headers.get(this.#typeHeader), buffer);
      }
      else {
        output = await response.text();
      }
      response.bodyDecoded = output;
      if(this.config.enableDebug) {
        console.log(`${_options.method}: ${this.config.baseUrl}${url}`, response);
      }
      return [output, response, response.headers.get(this.#typeHeader)];
  }
  async get(url, type = null, options = {}) { return await this.fetch('GET', url, type, null, options); };
  async put(url, type, data = null, options = {}) { return await this.fetch('PUT', url, type, data, options); };
  async post(url, type, data = null, options = {}) { return await this.fetch('POST', url, type, data, options); };
  async delete(url, type, data = null, options = {}) { return await this.fetch('DELETE', url, type, data, options); };

  // calculateSize struct size
  #calculateSize(fields = []) {
    return fields.reduce((size, { type, arraySize }) => {
      let typeSize = this.getType(type).size || this.#calculateSize(this.getType(type).fields);
      return size + (arraySize ? typeSize * arraySize : typeSize);
    }, 0);
  }

  // encodeClientType
  #encodeClientType(type, value) {
    if(value === undefined) {
      return value;
    }
    switch(type) {
      case "float": 
        return parseFloat(value.toFixed(6));
        // return new Float32Array(1)[0] = value;
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
    if(value === undefined) {
      return value;
    }
    switch(type) {
      case "float": 
        return parseFloat(value.toFixed(6));
      case "bool": 
        return !!value;
      case "char": 
        if(value === 0) {
          return '';
        }
        return String.fromCharCode(value);
      default: 
        return value;
    }
  };

  // debugArrayBuffer(buffer) {
  //   const bytes = new Uint8Array(buffer);
  //   let out = '';
  //   for(let i = 0; i < bytes.length; i++) {
  //     if(bytes[i] === 0) {
  //       out += ' ';
  //     }
  //     else {
  //       out += String.fromCharCode(bytes[i]);
  //     }
  //   }
  //   console.log(out);
  //   return out;
  // }

  getEmptyType(type) {
    const typeInfo = this.getType(type);
    if(typeInfo.primitive) {
      const v = this.#decodeClientType(type, typeInfo.value || 0);
      if(typeInfo.arraySize) {
        if(type === 'char') {
          v = typeInfo.value || '';
        }
        else {
          v = Array.from({ length: typeInfo.arraySize }, () => v);
        }
      }
      return v;
    }
    let fields = typeInfo.fields;
    let obj = {};
    for(const { type, name, arraySize } of fields) {
      const v = this.getEmptyType(type);
      if(arraySize && type != 'char') {
        obj[name] = Array.from({ length: arraySize }, () => v);
      }
      else {
        obj[name] = v;
      }
    };
    return obj;
  }

  // unpack an ArrayBuffer back into structured data
  decode(type, buffer) {
    const typeInfo = this.getType(type);
    if(!typeInfo) {
      throw new Error(`Decoding unknown type '${type}'`);
    }
    let fields = [];
    if(typeInfo.primitive) {
      // primitive data type
      fields = [{ type, name: 'value'}];
      if(buffer.byteLength > typeInfo.size) {
        if(buffer.byteLength % typeInfo.size !== 0) {
          throw new Error("Invalid array buffer size for type.", );
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
      if (arraySize) {
        obj[name] = [];
        for (let i = 0; i < arraySize; i++) {
          offset = this.#generateDecoding(buffer, view, offset, obj, type, name, true);
        }
        if(type === 'char') {
          obj[name] = obj[name].join('');
        }
      } else {
        offset = this.#generateDecoding(buffer, view, offset, obj, type, name);
      }
    });

    if(typeInfo.primitive) {
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
      if(isArray) {
        obj[varName].push(value);
      }
      else {
        obj[varName] = value;
      }
      offset += typeInfo.size;
    } else {
      let subBuffer = buffer.slice(offset, offset + this.#calculateSize(this.getType(type).fields));
      const value = this.decode(type, subBuffer);
      if(isArray) {
        obj[varName].push(value);
      }
      else {
        obj[varName] = value;
      }
      offset += subBuffer.byteLength;
    }
    return offset;
  }

  // pack an object back into an ArrayBuffer
  encode(type, data) {
    let fields = [];
    const typeInfo = this.getType(type);
    if(typeInfo.primitive) {
      // primitive data type
      fields = [{ type, name: 'value'}];
      if(Array.isArray(data)) {
        fields[0].arraySize = data.length;
      }
      data = {value: data};
    }
    else {
      //struct data type
      fields = this.getType(type).fields;
    }

    let buffer = new ArrayBuffer(this.#calculateSize(fields));
    let view = new DataView(buffer);
    let offset = 0;

    fields.forEach(({ type, name, arraySize }) => {
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

  #computeChecksum(data) {
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
