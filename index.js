const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("express-jwt");
const { ApolloServer } = require("apollo-server-express");

const Config = require("./config");
const Model = require("./model");
const Controller = require("./controller");
const Monitor = require("./monitor");

module.exports = class Microservice {
  constructor(config) {
    this.config = new Config(config);
  }

  async init() {
    await this.config.init();
    this.monitor = new Monitor(this.config);
    this.model = new Model(this.config);
    this.controller = new Controller(this.config);

    const host = this.config.get("host") || "0.0.0.0";
    const port = process.env.PORT || this.config.get("port") || 80;
    const accessControl = this.config.get("accessControl") || {};
    const app = express();

    // get tracking data
    app.use((req, res, next) => {
      req.requesterIp = req.date = new Date();
      next();
    });

    // Access control
    app.use((req, res, next) => {
      const ip = req.connection.localAddress;
      next(
        accessControl && accessControl.ip && ip != accessControl.ip
          ? "Access Denied"
          : null
      );
    });

    // Body parser
    app.use(bodyParser.json());

    // Session
    const jwtOptions = this.config.get("jwt.options");
    if (jwtOptions) app.use(jwt(jwtOptions));

    // Configure tracking and log request
    app.use((req, res, next) => {
      const trace = this.monitor.trace(
        req.user && req.user._id,
        req.headers["x-forwarded-for"] || req.connection.remoteAddress
      );

      req.trace = trace;
      next();
    });

    app.use((req, res, next) => {
      next();
      this.monitor.log(JSON.stringify(req.body), req.trace._id);
    });

    const server = new ApolloServer(this.controller);
    server.createGraphQLServerOptions = req => ({
      schema: server.schema,
      context: {
        session: req.user,
        trace: req.trace
      },
      formatError: res => {
        this.monitor.log(JSON.stringify(res.body), req.trace._id, "error");
        return res;
      },
      formatResponse: res => {
        this.monitor.log(JSON.stringify(res.body), req.trace._id);
        return res;
      }
    });
    server.applyMiddleware({ app, path: this.config.get("graphql.path") });

    app.listen(port, host, () => {
      console.log(`🚀  Server ready at ${host}:${port} `);
    });
  }
};
