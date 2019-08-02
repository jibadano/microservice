const express = require('express')
const bodyParser = require('body-parser')
const jwt = require('express-jwt')
const jsonwebtoken = require('jsonwebtoken')

const { ApolloServer } = require('apollo-server-express')
const Config = require('./config')
const Model = require('./model')
const Controller = require('./controller')
const Monitor = require('./monitor')

module.exports = class Microservice {
  constructor(config) {
    this.config = new Config(config)
    this.sign = () => {}
  }

  async init() {
    await this.config.init()

    this.monitor = new Monitor(this.config)
    this.model = new Model(this.config)
    this.controller = new Controller(this.config)
    this.sign = () => {}

    const host = this.config.get('host') || '0.0.0.0'
    const port = process.env.PORT || this.config.get('port') || 80
    const accessControl = this.config.get('accessControl') || {}
    const app = express()

    // Access control
    app.use((req, res, next) => {
      const ip = req.connection.localAddress
      console.log('REQUEST IP', ip)

      next(
        accessControl && accessControl.ip && ip != accessControl.ip
          ? 'Access Denied'
          : null
      )
    })

    // Body parser
    app.use(bodyParser.json())

    // Session
    const jwtOptions = this.config.get('jwt.options')
    const jwtSignOptions = this.config.get('jwt.signOptions')
    if (jwtOptions) {
      this.sign = data =>
        jsonwebtoken.sign(data, jwtOptions.secret, jwtSignOptions)

      app.use(jwt(jwtOptions))
    }

    // Tracing
    app.use((req, res, next) => {
      const trace = this.monitor.trace(
        req.body.operationName,
        req.user && req.user.user && req.user.user._id,
        req.headers['x-forwarded-for'] || req.connection.remoteAddress
      )

      req.trace = trace
      req.log = (message, body, type) => {
        this.monitor.log(message, trace._id, body, type)
      }
      next()
    })

    app.use((req, res, next) => {
      req.log('request', req.body.query)
      next()
    })

    const server = new ApolloServer(this.controller)
    server.createGraphQLServerOptions = req => ({
      schema: server.schema,
      context: {
        session: req.user,
        trace: req.trace,
        log: req.log
      },
      formatError: res => {
        req.log('response', JSON.stringify(res.data), 'error')
        return res
      },
      formatResponse: res => {
        req.log('response', JSON.stringify(res.data))
        return res
      }
    })
    server.applyMiddleware({ app, path: this.config.get('graphql.path') })

    app.listen(port, host, () => {
      console.log(`🚀  Server ready at ${host}:${port} `)
    })
  }
}
