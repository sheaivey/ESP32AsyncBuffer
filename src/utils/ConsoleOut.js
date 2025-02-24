class ConsoleOut {
  messages = [];

  //prints message immediately 
  print(...args) {
    this.send(...args);
  }

  print(...args) {
    this.send(...args);
  }

  // queues message for displaying later
  queue(msg, ...args) {
    this.messages.push([msg, args]);
  }

  // print immediately 
  send(msg = "", ...args) {
    let c = ["", ""];
    if(msg.indexOf("ERROR") !== -1) {
      c = ["\x1b[31m", "\x1b[0m"];
    }
    else if(msg.indexOf("WARNING") !== -1) {
      c = ["\x1b[33m", "\x1b[0m"];
    }
    else if(msg.indexOf("INFO") !== -1) {
      c = ["\x1b[34m", "\x1b[0m"];
    }
    else if(msg.indexOf("SUCCESS") !== -1) {
      c = ["\x1b[32m", "\x1b[0m"];
    }
    console.log(`${c[0]}${msg}${c[1]}`, ...args);
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