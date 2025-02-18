const fs = require("fs");

watchingDirectories = [];
watchTimeout = null;
eventsQueue = [];
function watchForChanges(directoryToWatch, callback = (eventType, filename) => {}, options = { recursive: true, throttled: 1000 }) {
  if(watchingDirectories.includes(directoryToWatch)) {
    return; // already watching dir
  }
  
  fs.watch(directoryToWatch, options, (e, f) => {
    eventsQueue.push([e, directoryToWatch + f]);
    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => {
      callback(eventsQueue);
      eventsQueue = [];
    }, options.throttled);
  });

  watchingDirectories.push(directoryToWatch);
}

module.exports = watchForChanges;