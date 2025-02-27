function replaceAfterIndex(text, search, index, replacement) {
  if (index < 0 || index > text.length) {
    return text;
  }
  const before = text.substring(0, index);
  const after = text.substring(index, text.length).replace(search, replacement);
  return before + after;
}

class ConsoleOut {
  messages = [];

  //prints message immediately 
  print(...args) {
    this.send(...args);
  }

  log(...args) {
    this.send(...args);
  }

  // queues message for displaying later
  queue(msg, ...args) {
    this.messages.push([msg, args]);
  }

  // print immediately 
  send(msg = "", ...args) {
    let c = ["", ""];
    let fullLine = false;
    if(msg.indexOf("ERROR:") !== -1) {
      c = ["\x1b[31m", "\x1b[0m"];
      fullLine = true;
    }
    else if(msg.indexOf("WARNING:") !== -1) {
      c = ["\x1b[33m", "\x1b[0m"];
      fullLine = true;
    }
    else if(msg.indexOf("INFO:") !== -1) {
      c = ["\x1b[34m", "\x1b[0m"];
    }
    else if(msg.indexOf("SUCCESS:") !== -1) {
      c = ["\x1b[32m", "\x1b[0m"];
    }
    if (fullLine) {
      console.log(`${c[0]}${msg}`, ...args, `\b${c[1]}`);
      return;
    }
    let firstNumber = true;
    [...msg.matchAll(/(["'][^ ]*["'])|(\$?\-?\+?,*?\d*\.*?\d+\w*\%?)/g)].forEach((m) => {
      let b = ["", ""];
      if (m[0].indexOf("'") !== -1 || m[0].indexOf('"') !== -1) {
        b = ["\x1b[32m", "\x1b[0m"];
      }
      else if ([...m[0].matchAll(/B|KB|MB|GB|TB/gmi)].length) {
        let v = parseFloat(m[0]);
        if (firstNumber) {
          if(v <= 1.5) {
            b = ["\x1b[32m", "\x1b[0m"];
          }
          else if(v > 5 && v <= 10) {
            b = ["\x1b[33m", "\x1b[0m"];
          }
          else if(v > 10) {
            b = ["\x1b[31m", "\x1b[0m"];
          }
          else {
            b = ["\x1b[37m", "\x1b[0m"];
          }
          firstNumber = false;
        }
        else {
          b = ["\x1b[30m", "\x1b[0m"];
        }
      }
      else if (m[0].indexOf('$') === 0) {
        b = ["\x1b[32m", "\x1b[0m"];
      }
      else if (m[0].indexOf('%') !== -1) {
        b = ["\x1b[35m", "\x1b[0m"];
      }
      else {
        b = ["\x1b[33m", "\x1b[0m"];
      }

      msg = replaceAfterIndex(msg, m[0], m.index, `${b[0]}${m[0]}${b[1]}`);
    });
    ["ERROR:", "WARNING:", "INFO:", "SUCCESS:"].forEach((s) => msg = msg.replace(s, `${c[0]}${s}${c[1]}`));
    console.log(msg, ...args);
  }
  
  // output the queue
  show() {
    this.messages.forEach(([m, a]) => this.send(m, ...a));
  }

  // output the queue and clear when done.
  flush() {
    this.show();
    this.messages = [];
  } 

  // clear the console
  clear() {
    console.log("\x1Bc");
  }
}
const globalConsole = new ConsoleOut();
module.exports = globalConsole;