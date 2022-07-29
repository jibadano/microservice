const mongoose = require('mongoose')
const moment = require('moment')
const { v1: uuidv1 } = require('uuid')
const TraceSchema = require('./model/trace')

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

        this.Trace = monitorConnection.model('Trace', TraceSchema)

        if (monitorConfig.exp) {
          let amount = monitorConfig.exp
          let unit = 'milliseconds'
          if (monitorConfig.exp.amount) amount = monitorConfig.exp.amount
          if (monitorConfig.exp.unit) unit = monitorConfig.exp.unit

          this.Trace.deleteMany({
            date: {
              $lte: moment().subtract(parseInt(amount), unit).toDate()
            }
          }).exec()
        }
      } else {
        this.mode = MODES.CONSOLE
      }
    }

    this.mode != 'off' && console.info(`📝Monitor READY mode=${this.mode}`)
  }

  log(message, trace, data, type = 'info') {
    if (this.mode === 'off')
      return typeof trace == 'object' ? trace : { operation: trace }

    let logData = typeof data == 'object' ? JSON.stringify(data) : data
    logData = logData && logData.indexOf('\n') > 0 ? '\n' + logData : logData

    if (typeof trace == 'object' && trace._id) {
      //Is an update
      if (this.Trace)
        this.Trace.updateOne(
          { _id: trace._id },
          { $push: { logs: { message, data, type } } }
        )
          .exec()
          .then((result) => {
            if (!result.nModified) {
              setTimeout(() => {
                this.Trace.updateOne(
                  { _id: trace._id },
                  { $push: { logs: { message, data, type } } }
                ).exec()
              }, 1000)
            }
          })
      else console.log('>', Date.now(), trace._id, message, data)

      return
    }

    //New log

    if (typeof trace != 'object') {
      //Is an in line log
      trace = {
        operation: trace
      }
    }

    trace._id = uuidv1()
    trace.date = Date.now()
    trace.environment = process.env.NODE_ENV
    trace.logs = [
      {
        message,
        data,
        type
      }
    ]

    if (this.Trace) {
      new this.Trace(trace).save()
    } else {
      console.info(
        '>>>',
        trace.date,
        trace._id,
        trace.operation,
        trace.user,
        trace.ip,
        trace.module,
        trace.environment
      )
      console[type]('>', Date.now(), trace._id, message, data)
    }

    return trace
  }
}
