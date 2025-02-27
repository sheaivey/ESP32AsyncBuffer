const AsyncBufferAPI = module.require('../AsyncBufferAPI.js');
const consoleOut = module.require('./ConsoleOut.js');
let bufferAPI;

function removeComments(string) {
  //Takes a string of code, not an actual function.
  return string.replace(/\/\*[\s\S]*?\*\/|(?<=[^:])\/\/.*|^\/\/.*/g,'').trim();//Strip comments
}

function extractBracedBlocks(input, startKeyword, endKeyword, removeChildBlocks = false) {
  let results = [];
  let regex = new RegExp(`(${startKeyword}[^{}]*{)`, "g"); // Match start line with '{'
  let matches;
  
  while ((matches = regex.exec(input)) !== null) {
    let startIdx = matches.index; // Start of "struct {"
    let stack = [];
    let endIdx = -1;
    let block = "";
    let blockBody = "";
    for (let i = startIdx; i < input.length; i++) {
      if (input[i] === "}") stack.pop();
      if (stack.length <= 1 || removeChildBlocks === false) {
        block += input[i];
        if(stack.length >= 1) {
          blockBody += input[i];
        }
      }
      if (input[i] === "{") stack.push(i);

      if (stack.length === 0) {
        let potentialEnd = i + endKeyword.length;
        let wholeBlock = input.substring(startIdx, potentialEnd);
        let endIndexTest = wholeBlock.lastIndexOf(endKeyword);
        if (endIndexTest > 1 && endIndexTest === wholeBlock.length - endKeyword.length ) {
          endIdx = potentialEnd;
          results.push([block, blockBody]);
          break;
        }
      }
    }
  }
  return results;
}

const structRegex = /struct\s+(\w+)/g;
const variableRegex = /^\s*([\w\s:*&<>]+?)\s*(\w+)(?:\s*\[\s*(\d*)\s*\])?\s*?(:?\=[\d\w\s\[\]\.\{\}\"]*)?;/gm;

// Parse C++ struct definitions
function parseStructs(content) {
  bufferAPI = new AsyncBufferAPI();
  let structs = {};
  let match;
  content = removeComments(content);
  const structNames = [];
  const structsBodies = {};
  const results = extractBracedBlocks(content, "struct", "};", true);
  results.forEach(([fullBlock, body]) => {
    while ((match = structRegex.exec(fullBlock))) {
      let [_, name] = match;
      structsBodies[name] = body;
      structNames.push(name);
    }
  });

  structNames.forEach((key, index) => {
    structName = key;
    body = structsBodies[key];
    let fields = [];

    let variables = [...body.matchAll(variableRegex)];
    variables.forEach(varMatch => {
      let field = { type: varMatch[1], name: varMatch[2] };
      let arraySize = parseInt(varMatch[3] || 0);
      let defaultValue = null;
      try {
        defaultValueString = (varMatch[4] || "").replace('=', '').trim();
        defaultValue = JSON.parse(defaultValueString);
        if(defaultValueString !== "{}") {
          field.value = defaultValue;
        }
      }
      catch {
      }
      if(arraySize) {
        field.arraySize = arraySize;
      }
      if(field.type.indexOf("*") != -1 || field.type.indexOf("&") != -1) {
        consoleOut.queue(`WARNING: POINTER USAGE '${structName}::*${field.name}'\n  Pointers can change during runtime and are not guaranteed to be the same between \n  requests or reboots. Not recommended to manipulate data.`);
        field.isPointer = true;
        field.type = "uint32_t";
      }
      if (!bufferAPI.getType(field.type, false) && !structsBodies[field.type]) {
        consoleOut.queue(`ERROR: UNKNOWN TYPE '${field.type}' in '${structName}::${field.name}'\n  This will cause unpacking errors for '${structName}' struct, \n  check your spelling or try using one of the primitive types.`);
      }
      fields.push(field);
    });
    structs[structName] = { fields }; // struct ids start at 50
    console.log(structName, fields, "\b;\n");
  });
  let customTypes = bufferAPI.addType(structs); // add all the parsed structs to the bufferAPI
  const out = {};
  customTypes.forEach(it => out[it.name] = it);
  return out;
};

const getAllTypes = () => {
  return bufferAPI.getTypes();
}

module.exports = {
  parseStructs,
  getAllTypes
};