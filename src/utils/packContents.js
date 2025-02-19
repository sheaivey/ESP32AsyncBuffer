const fs = require("fs");
const zlib = require('zlib');
const path = require("path");
const requireWithInstall = require("./requireWithInstall.js");
const consoleOut = require("./ConsoleOut.js");
const minifyJS = requireWithInstall("terser").minify;
const minifyHTML = requireWithInstall('html-minifier').minify;
const UglifyJS = requireWithInstall('uglify-es').minify;
const mime = requireWithInstall('mime-types');

async function makeUgly(filePath, byteBuffer) {
  // TODO: Minify HTML, JS, CSS is still not working, consider using Rollup for this task.
  // rollup could allow for inline includes to reduce requests.

  var uglifyEsOptions = { parse: { bare_returns: false }, sourceMap: false };
  switch(path.extname(filePath)) {
    case ".js": {
      const contents = Buffer.from(byteBuffer).toString("utf8");
      uglifyEsOptions.parse.bare_returns = false;
      const result = await minifyJS(contents, uglifyEsOptions);
      return Buffer.from(result.code, "utf-8");
    }
    case ".html": {
      // not working!
      const contents = Buffer.from(byteBuffer).toString("utf8");
      const result = await minifyHTML(contents, {
        collapseInlineTagWhitespace: true,
        minifyCSS: true,
        minifyJS: (text, inline) => {
          uglifyEsOptions.parse.bare_returns = inline;
          const result = UglifyJS(text, uglifyEsOptions);
          return text;
        },
        removeComments: true,
      });
      return Buffer.from(result, "utf-8");
    }
    default: 
      // do nothing
  }

  return byteBuffer;
};

function roundTo(number, decimals = 1) {
  const pow = Math.pow(10, decimals);
  return Math.round(number * pow) / pow;
}


async function packContents(filePath, fileContents, options = {gzip: false, minify: false}) {
  const fileName = path.basename(filePath).replace(/([^A-Za-z0-9]+)/i,"_").toUpperCase();
  if(typeof fileContents == "string") {
    fileContents = Buffer.from(fileContents, "utf-8"); // convert to byteArray
  }
  if(options.minify) {
    byteBuffer = await makeUgly(filePath, fileContents);
  }
  else {
    byteBuffer = fileContents;
  }
  if(options.gzip === true) {
    byteBuffer = zlib.gzipSync(fileContents);
  }
  let savings = `(was ${roundTo(fileContents.length/1024)}kb saved ${roundTo((fileContents.length - byteBuffer.length)/1024)}kb or ${roundTo((1 - (byteBuffer.length/fileContents.length)) * 100)}% reduction)`;
  if(byteBuffer.length > fileContents.length) {
    // original file was better :(
    byteBuffer = fileContents;
    savings = "";
  }
  consoleOut.queue(`INFO: "${fileName}" - ${roundTo(byteBuffer.length/1024)}kb ${savings}`);

  const etag = new Date().getTime().toString().slice(-5);
  let output = `const char FILE_${fileName}_CONTENT_TYPE[] PROGMEM = "${mime.lookup(path.basename(filePath))}";\n`;
      output+= `const char FILE_${fileName}_ETAG[] PROGMEM = "${etag}";\n`;
      output+= `const bool FILE_${fileName}_GZIP = ${options.gzip ? "true" : "false"};\n`;
  let hexArray = byteBuffer.toString("hex").match(/.{1,2}/g).join(", 0x");
  hexArray = `0x${hexArray}`;
  output += `const uint8_t FILE_${fileName}[] PROGMEM = { ${hexArray} };\n`;

  output += "\n";
  return [
    output, 
    { // info
      path: `${filePath}`, 
      bodyName: `FILE_${fileName}`, 
      etagName: `FILE_${fileName}_ETAG`, 
      gzipName: `FILE_${fileName}_GZIP`,
      contentTypeName: `FILE_${fileName}_CONTENT_TYPE`,
    }
  ];
}

module.exports = packContents;