class ConsoleOut {
  messages = [];

  //prints message immediately 
  print(msg = "") {
    this.send(msg, type);
  }

  // queues message for displaying later
  queue(msg) {
    this.messages.push(msg);
  }

  send(msg = "", type = null) {
    let c = ["", ""];
    if(msg.indexOf("ERROR") !== -1 || type == "ERROR") {
      c = ["\x1b[31m", "\x1b[0m"];
    }
    else if(msg.indexOf("WARNING" || type == "WARNING") !== -1) {
      c = ["\x1b[33m", "\x1b[0m"];
    }
    else if(msg.indexOf("INFO" || type == "INFO") !== -1) {
      c = ["\x1b[34m", "\x1b[0m"];
    }
    else if(msg.indexOf("SUCCESS" || type == "SUCCESS") !== -1) {
      c = ["\x1b[32m", "\x1b[0m"];
    }
    console.log(`${c[0]}${msg}${c[1]}`);
  }
  
  // output the queue
  show() {
    this.messages.forEach(this.send);
  }

  // clear the queue
  clear() {
    this.messages = [];
  }

  // output the queue and clear when done.
  flush() {
    this.show();
    this.clear();
  }
}
const globalConsole = new ConsoleOut();
module.exports = globalConsole;