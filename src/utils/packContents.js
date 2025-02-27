const fs = require("fs");
const zlib = require('zlib');
const path = require("path");
const {roundTo, requireWithInstall} = require("./helpers.js");
const makeUgly = require("./makeUgly.js");
const consoleOut = require("./ConsoleOut.js");
const mime = requireWithInstall('mime-types');

async function packContents(filePath, fileContents, options = {inline: false, gzip: false, minify: false, outputSources: false, rootDir: ""}) {
  const fileName = path.basename(filePath).replace(/([^A-Za-z0-9]+)/ig,"_").toUpperCase();
  if(typeof fileContents == "string") {
    fileContents = Buffer.from(fileContents, "utf-8"); // convert to byteArray
  }
  if(options.minify) {
    byteBuffer = await makeUgly(filePath, fileContents, options);
  }
  else {
    byteBuffer = fileContents;
  }
  if(options.gzip === true) {
    byteBuffer = zlib.gzipSync(byteBuffer);
  }
  let savings = `(was ${roundTo(fileContents.length/1024)}KB saved ${roundTo((fileContents.length - byteBuffer.length)/1024)}KB or ${roundTo((1 - (byteBuffer.length/fileContents.length)) * 100)}% reduction)`;
  if(options.inline === false && byteBuffer.length > fileContents.length) {
    // original file was better :(
    byteBuffer = fileContents;
    savings = "";
    options.gzip = false;
  }
  if(byteBuffer.length >= fileContents.length) {
    savings = "";
  }
  let hexDataString = "";
  if(byteBuffer.length) {
    hexDataString = `0x${byteBuffer.toString("hex").match(/.{1,2}/g).join(", 0x")}`;
  }

  consoleOut.print(`URL: ${(`'${filePath.replace(options.rootDir, '')}'`).padEnd(20,' ')} - ${roundTo(byteBuffer.length/1024).toString().padStart(6, ' ')}KB ${savings}`);

  const etag = new Date().getTime().toString().slice(-5);
  const urlName = `FILE_${fileName}_URL`;
  const bodyName= `FILE_${fileName}_BODY`;
  const etagName= `FILE_${fileName}_ETAG`;
  const gzipName= `FILE_${fileName}_GZIP`;
  const contentTypeName= `FILE_${fileName}_CONTENT_TYPE`;
  const staticFileName = `FILE_${fileName}`;

  let output = `const char ${urlName}[] PROGMEM = "${filePath.replace(options.rootDir, '').replace('index.html', '')}";\n`;
      output+= `const char ${contentTypeName}[] PROGMEM = "${mime.lookup(path.basename(filePath))}";\n`;
      output+= `const char ${etagName}[] PROGMEM = "${etag}";\n`;
      output+= `const bool ${gzipName} = ${options.gzip ? "true" : "false"};\n`;
      output+= `const uint8_t ${bodyName}[] PROGMEM = { ${hexDataString} };\n`;
      output+= `const AsyncBufferStaticFile ${staticFileName} = {${urlName}, ${contentTypeName}, ${etagName}, ${bodyName}, sizeof(${bodyName}), ${gzipName}};\n`;

  output += "\n";
  return [
    output, 
    { // info
      path: filePath,
      contents: byteBuffer,
      outSize: byteBuffer.length,
      inSize: fileContents.length,
      staticFileName: staticFileName,
    }
  ];
}

module.exports = packContents;