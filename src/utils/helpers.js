const fs = require("fs");
const path = require("path");
const consoleOut = require("./ConsoleOut.js");
const { execSync } = require('child_process');

const scriptDir = path.dirname(process.argv[1]);
const workingDir = process.cwd() || '.';
const isBuildingLibrary = workingDir == scriptDir;

function requireWithInstall(packageName) {
    try {
        return require(packageName);
    } catch (e) {
        console.log(`Installing missing packages!`);
        try {
          // run npm install in the script dir not the users project dir.
          execSync(`cd ${path.dirname(process.argv[1])} && npm install && sleep 1`, { stdio: 'ignore' }); //inherit
        }
        catch {}
        let tries = 0;
        let module = null;
        while(tries++ < 2 && module === null) {
          try {
            module = require(packageName);
          }
          catch(err) {
            console.log("retrying!", err);
            execSync(`sleep 2`, { stdio: 'inherit' }); // sometimes filesystem is slow after install.
          }
        }
        if(module !== null) {
          console.log(`Done!`);
          return module;
        }
        else {
          // everything is installed but node process is lagging :(
          console.log('Failed! Try running the script again :)');
          process.exit(1);
        }
    }
}

function readDirR(dir) {
  let files;
  if(!fs.existsSync(dir)) {
    !isBuildingLibrary && consoleOut.queue(`WARNING: Directory '.${dir.replace(scriptDir, '')}' does not exist!`);
    return [];
  }
  try{
    files = fs.statSync(dir).isDirectory()
      ? Array.prototype.concat(...fs.readdirSync(dir).map(f => {
        return readDirR(path.join(dir, f));
      })).filter(f => !['.DS_Store'].includes(path.basename(f))) // filter out hidden files
      : dir;
      return files;
  }
  catch(error) {
    !isBuildingLibrary && consoleOut.queue(`ERROR: Traversing directory '.${dir.replace(scriptDir, '') }'`);
  }
  return [];
}

function createFile(filePath, content = '') {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  } catch (error) {
    consoleOut.queue(`ERROR: Creating file "${filePath}"`);
  }
}

function roundTo(number, decimals = 2) {
  const pow = Math.pow(10, decimals);
  return Math.round(number * pow) / pow;
}

module.exports = {
  roundTo,
  readDirR,
  createFile,
  requireWithInstall
}