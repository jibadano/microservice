const mongoose = require('mongoose')
const uuidv1 = require('uuid/v1')

const LogSchema = new mongoose.Schema({
  trace: { type: String, ref: 'Trace' },
  timestamp: { type: Date, default: Date.now },
  message: String,
  data: String,
  type: String
})

const TraceSchema = new mongoose.Schema({
  _id: String,
  user: String,
  operation: String,
  ip: String,
  module: String,
  date: { type: Date, default: Date.now },
  environment: String
})

const MODES = {
  OFF: 'off',
  CONSOLE: 'console',
  DB: 'db'
}

module.exports = class Monitor {
  constructor(config) {
    const monitorConfig = config.get('monitor')

    if (!monitorConfig || monitorConfig.mode === MODES.OFF) {
      this.mode = MODES.OFF
    } else {
      const mongoPath = monitorConfig.mongo
      this.module = config.moduleName
      if (mongoPath && monitorConfig.mode !== MODES.CONSOLE) {
        this.mode = MODES.DB
        const monitorConnection = mongoose.createConnection(mongoPath, {
          useNewUrlParser: true,
          useUnifiedTopology: true
        })

        this.Log = monitorConnection.model('Log', LogSchema)
        this.Trace = monitorConnection.model('Trace', TraceSchema)
      } else {
        this.mode = MODES.CONSOLE
      }
    }

    this.mode != 'off' && console.info(`📝Monitor READY mode=${this.mode}`)
  }

  log(message, trace, data, type = 'info') {
    if (this.mode === 'off') return
    const log = {
      trace: typeof trace == 'object' ? trace : this.trace(trace),
      message,
      type,
      data
    }
    this.Log
      ? new this.Log(log).save()
      : console[type]('>', new Date(), trace, message, data)
  }

  trace(operation, user, ip, date = new Date()) {
    const trace = {
      _id: uuidv1(),
      operation,
      user,
      ip,
      date,
      environment: process.env.NODE_ENV,
      module: this.module
    }

    if (this.mode !== 'off')
      this.Trace
        ? new this.Trace(trace).save()
        : console.log(
            '>',
            date,
            trace._id,
            trace.operation,
            trace.user,
            trace.ip,
            trace.module,
            trace.environment
          )

    return trace
  }
}
