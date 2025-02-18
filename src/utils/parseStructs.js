const AsyncWebServerBufferAPI = module.require('../AsyncWebServerBufferAPI.js');
const consoleOut = module.require('./ConsoleOut.js');
const bufferAPI = new AsyncWebServerBufferAPI();

function removeComments(string) {
  //Takes a string of code, not an actual function.
  return string.replace(/\/\*[\s\S]*?\*\/|(?<=[^:])\/\/.*|^\/\/.*/g,'').trim();//Strip comments
}

// Parse C++ struct definitions
function parseStructs(content) {
  let structs = {};
  let match;
  content = removeComments(content);
  const structRegex = /struct\s+(\w+)\s*\{([\s\S]*?)\};/g;
  const structNames = [];
  const structsBodies = {};
  while ((match = structRegex.exec(content))) {
    let [_, name, body] = match;
    structsBodies[name] = body;
    structNames.push(name);
  }
  structNames.forEach((key) => {
    structName = key;
    body = structsBodies[key];
    let fields = [];

    const variableRegex = /^\s*([\w\s:*&<>]+?)\s*(\w+)(?:\s*\[\s*(\d*)\s*\])?\s*;/gm;
    let variables = [...body.matchAll(variableRegex)];
    variables.forEach(varMatch => {
      let field = { type: varMatch[1], name: varMatch[2] };
      let arraySize = parseInt(varMatch[3] || 0);
      if(arraySize) {
        field.arraySize = arraySize;
      }
      if(field.type.indexOf("*") != -1 || field.type.indexOf("&") != -1) {
        consoleOut.queue(`WARNING POINTER USAGE: "${structName}::${field.name}" - Pointers can change during runtime and are not guaranteed to be the same between requests or reboots. Not recommended to manipulate data.`);
        field.isPointer = true;
        field.type = "uint32_t";
      }
      if (!bufferAPI.getType(field.type, false) && !structsBodies[field.type]) {
        consoleOut.queue(`ERROR UNKNOWN TYPE: ${field.type} - This will cause unpacking errors.`);
      }
      fields.push(field);
    });
    structs[structName] = { fields };
    console.log(structName, fields, "\b;\n");
  });
  
  return structs;
};

module.exports = parseStructs;