const EventEmitter = require('events');
const bus = new EventEmitter();

module.exports = {
  EventBus: bus,
  logInfo: (msg) => console.log('[INFO]', msg),
};
