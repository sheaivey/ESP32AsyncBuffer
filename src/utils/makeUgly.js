const fs = require("fs");
const path = require("path");
const { requireWithInstall } = require("./helpers.js");
const consoleOut = require("./ConsoleOut.js");


const minifyHTML = requireWithInstall("html-minifier-terser").minify;
const minifyCSS = requireWithInstall("csso").minify;
const minifyJS = requireWithInstall("terser").minify;

var minifyJsOptions = { parse: { bare_returns: false }, sourceMap: false };
async function makeUgly(filePath, byteBuffer, options = {inline: false}) {
  try {
    switch(path.extname(filePath)) {
      case ".js": {
        const contents = Buffer.from(byteBuffer).toString("utf8");
        const result = await minifyJS(contents, minifyJsOptions);
        return Buffer.from(result.code, "utf-8");
      }
      case ".css": {
        const contents = Buffer.from(byteBuffer).toString("utf8");
        const result = minifyCSS(contents).css;
        return Buffer.from(result, "utf-8");
      }
      case ".html": {
        let html = Buffer.from(byteBuffer).toString("utf8");
        // Inline CSS and JS if enabled
        if (options.inline) {
          const basedir = filePath.replace(path.basename(filePath), '');
          html = await inlineAssets(basedir, html);
        }

        // Minify HTML
        result = await minifyHTML(html, {
          collapseWhitespace: true,
          removeComments: true,
          minifyCSS: true,
          minifyJS: true,
        });
        return Buffer.from(result, "utf-8");
      }
      default: 
        // do nothing
    }
  }
  catch(err) {
    consoleOut.print(`WARNING: Could not minify '${filePath}'\n  Skipping minification step \n  ${err}`);
  }
  return byteBuffer;
};

module.exports = makeUgly;

// Helper function to inline CSS, JS, and images
async function inlineAssets(basedir = "", html) {

  // Match all <link>, <script>, and <img> tags
  const regex =
    /<link\s+rel="stylesheet"\s+href="([^"]+)">|<script\s+src="([^"]+)"><\/script>|<img\s+src="([^"]+)"([^>]*)>/g;

  // Collect all replacements
  const matches = [...html.matchAll(regex)];

  // Process matches concurrently
  const replacements = await Promise.all(
    matches.map(async ([match, cssPath, jsPath, imgPath, imgAttrs]) => {
      try {
        if (cssPath) {
          // Inline CSS
          const cssFile = fs.readFileSync(path.join(basedir, cssPath), "utf-8");
          const minifiedCss = minifyCSS(cssFile).css;
          return [match, `<style>${minifiedCss}</style>`];
        } else if (jsPath) {
          // Inline JavaScript
          const jsFile = fs.readFileSync(path.join(basedir, jsPath), "utf-8");
          const minifiedJs = (await minifyJS(jsFile, minifyJsOptions)).code;
          return [match, `<script>${minifiedJs}</script>`];
        }
        // } else if (imgPath) {
        //   // Inline Images
        //   const imgExt = path.extname(imgPath).slice(1);
        //   const imgData = fs.readFileSync(path.join(basedir, imgPath));
        //   const base64 = imgData.toString("base64");
        //   return [match, `<img src="data:image/${imgExt};base64,${base64}" ${imgAttrs}>`];
        // }
      } catch (error) {
        consoleOut.log(`WARNING: Skipping inlining asset '${jsPath}'`);
      }
      return [match, match]; // Return original if failed
    })
  );

  // Replace all matches in HTML
  for (const [match, replacement] of replacements) {
    html = html.replace(match, replacement);
  }
  return html;
}