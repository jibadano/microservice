const express = require('express')
const bodyParser = require('body-parser')
const jwt = require('express-jwt')
const jsonwebtoken = require('jsonwebtoken')
const { ApolloServer } = require('apollo-server-express')
const Config = require('./config')
const Model = require('./model')
const Controller = require('./controller')
const Monitor = require('./monitor')
const Context = require('./context')
const Middleware = require('./middleware')
const Mail = require('./mail')

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
    this.context = new Context(this.config)
    this.middleware = new Middleware(this.config)
    this.mail = new Mail(this.config)

    const host = this.config.get('host') || '0.0.0.0'
    const port = process.env.PORT || this.config.get('port') || 80
    const accessControl = this.config.get('accessControl') || {}
    const graphqlPath = this.config.get('graphql.path') || '/graphql'
    const app = express()

    // Access control
    app.use((req, res, next) => {
      const ip = req.connection.localAddress

      next(
        accessControl && accessControl.ip && ip != accessControl.ip
          ? 'Access Denied'
          : null
      )
    })

    // Body parser
    app.use(bodyParser.json(this.config.get('bodyParser.json')))

    //Set middlewares
    this.middleware.list.forEach((mw) => app.use(mw))

    // Session
    const jwtOptions = this.config.get('jwt.options')
    const jwtSignOptions = this.config.get('jwt.signOptions')
    if (jwtOptions) {
      this.sign = (data, signOptions) =>
        jsonwebtoken.sign(
          data,
          jwtOptions.secret,
          signOptions || jwtSignOptions
        )

      app.use((req, res, next) => {
        jwt(jwtOptions)(req, res, () => next())
      })
    }

    // Tracing
    app.use((req, res, next) => {
      if (req && req.body && req.body.operationName == 'IntrospectionQuery')
        return next()

      const trace = this.monitor.log(
        'Request',
        {
          operation: req.body.operationName,
          user: req.user && req.user.user && req.user.user._id,
          ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        },
        req.body.query
      )

      req.trace = trace
      req.log = (message, body, type) => {
        this.monitor.log(message, trace, body, type)
      }
      next()
    })

    // Custom services
    this.controller.routes.forEach(({ method, path, handler }) => {
      if (!['get', 'post', 'put', 'delete', 'all'].includes(method)) return
      if (path == graphqlPath) return
      app[method](path, handler)
    })

    //Graphql services
    if (this.controller.resolvers && this.controller.resolvers.length > 1) {
      this.server = new ApolloServer(this.controller)
      this.server.createGraphQLServerOptions = (req, res) => {
        const context = {}
        this.context.handlers.forEach((contextItem) => {
          context[contextItem.name] = contextItem.handler(req, res)
        })

        return {
          schema: this.server.schema,
          context: {
            session: req.user,
            trace: req.trace,
            log: req.log,
            ...context
          },
          formatError: (res) => {
            req.log && req.log('Response', JSON.stringify(res), 'error')
            return res
          },
          formatResponse: (res) => {
            req.log && req.log('Response', JSON.stringify(res.data))
            return res
          }
        }
      }

      this.server.applyMiddleware({
        app,
        path: graphqlPath
      })
    }

    app.listen(port, host, () => {
      this.monitor.log('Server ready', 'start up', {
        name: this.config.get('name'),
        date: new Date().toLocaleDateString()
      })
      console.log(`🚀 Server READY at ${host}:${port} `)
    })

    return this.server
  }

  getModel(modelName) {
    return modelName ? this.model[modelName] : this.model
  }
}
