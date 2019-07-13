const mongoose = require("mongoose");
const uuidv1 = require("uuid/v1");

const LogSchema = new mongoose.Schema({
  trace: { type: String, ref: "Trace" },
  timestamp: { type: Date, default: Date.now },
  message: String,
  type: String
});

const TraceSchema = new mongoose.Schema({
  _id: String,
  user: String,
  ip: String,
  module: String,
  date: { type: Date, default: Date.now },
  environment: String
});

module.exports = class Monitor {
  constructor(config) {
    console.info(`📝 Monitor init`);
    const mongoPath = config.get("monitor.mongo");
    this.module = config.moduleName;
    if (mongoPath) {
      console.info(`📝 Monitor configuring mongo db`);
      mongoose
        .connect(mongoPath, { useNewUrlParser: true })
        .then(() => console.info(`📝 Monitor db connected`))
        .catch(console.error);

      this.Log = mongoose.model("Log", LogSchema);
      this.Trace = mongoose.model("Trace", TraceSchema);
    }
    console.info(`📝 Monitor init done`);
  }

  log(message, trace, type = "info") {
    const log = { trace, message, type };
    this.Log ? new this.Log(log).save() : console[type](log);
  }

  trace(user, ip, date = new Date()) {
    const _id = uuidv1();
    const trace = {
      _id,
      user,
      ip,
      date,
      environment: process.env.NODE_ENV,
      module: this.module
    };

    this.Trace ? new this.Trace(trace).save() : console.log(trace);

    return trace;
  }
};
