const fs = require("fs");
const zlib = require('zlib');
const path = require("path");
const {roundTo, requireWithInstall} = require("./helpers.js");
const makeUgly = require("./makeUgly.js");
const consoleOut = require("./ConsoleOut.js");
const mime = requireWithInstall('mime-types');

async function packContents(filePath, fileContents, options = {inline: false, gzip: false, minify: false}) {
  const fileName = path.basename(filePath).replace(/([^A-Za-z0-9]+)/i,"_").toUpperCase();
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

  consoleOut.queue(`INFO: "${fileName}" - ${roundTo(byteBuffer.length/1024)}KB ${savings}`);

  const etag = new Date().getTime().toString().slice(-5);
  let output = `const char FILE_${fileName}_CONTENT_TYPE[] PROGMEM = "${mime.lookup(path.basename(filePath))}";\n`;
      output+= `const char FILE_${fileName}_ETAG[] PROGMEM = "${etag}";\n`;
      output+= `const bool FILE_${fileName}_GZIP = ${options.gzip ? "true" : "false"};\n`;
  let hexDataString = "";
  if(byteBuffer.length) {
    hexDataString = `0x${byteBuffer.toString("hex").match(/.{1,2}/g).join(", 0x")}`;
  }
  output += `const uint8_t FILE_${fileName}[] PROGMEM = { ${hexDataString} };\n`;

  output += "\n";
  return [
    output, 
    { // info
      path: `${filePath}`,
      outSize: byteBuffer.length,
      inSize: fileContents.length,
      bodyName: `FILE_${fileName}`, 
      etagName: `FILE_${fileName}_ETAG`, 
      gzipName: `FILE_${fileName}_GZIP`,
      contentTypeName: `FILE_${fileName}_CONTENT_TYPE`,
    }
  ];
}

module.exports = packContents;