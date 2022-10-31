const express = require('express')
const bodyParser = require('body-parser')
const jwt = require('express-jwt')
const jsonwebtoken = require('jsonwebtoken')
const { ApolloServer } = require('apollo-server-express')
const Model = require('./model')
const Controller = require('./controller')
const Monitor = require('./monitor')
const Context = require('./context')
const Middleware = require('./middleware')
const Mail = require('./mail')
const { initConfig } = require('@jibadano/config/init')

class Microservice {
  constructor() {
    this.sign = () => {}
    this.verify = () => {}
  }

  async init() {
    try {
      await initConfig()
    } catch (e) {
      console.error(
        'No config found, you must specify a CONFIG_URL variable or a config.json file'
      )
      return process.exit(0)
    }
    const config = require('@jibadano/config')

    this.monitor = new Monitor(config)
    await this.monitor.init(config)

    this.model = new Model(config)
    await this.model.init(config)
    this.controller = new Controller(config)
    this.context = new Context(config)
    this.middleware = new Middleware(config)
    this.mail = new Mail(config)

    const host = config.get('host')
    const port = config.get('port')
    const accessControl = config.get('accessControl') || {}
    const graphqlPath = config.get('graphql.path') || '/graphql'
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
    app.use(bodyParser.json(config.get('bodyParser.json')))

    //Set middlewares
    this.middleware.list.forEach((mw) => app.use(mw))

    // Session
    const jwtOptions = config.get('jwt.options')
    const jwtSignOptions = config.get('jwt.signOptions')
    if (jwtOptions) {
      this.sign = (data, signOptions) =>
        jsonwebtoken.sign(
          data,
          jwtOptions.secret,
          signOptions || jwtSignOptions
        )

      this.verify = (token) => jsonwebtoken.verify(token, jwtOptions.secret)

      app.use((req, res, next) => {
        jwt(jwtOptions)(req, res, () => next())
      })
    }

    // Tracing
    app.use((req, res, next) => {
      if (req && req.method == 'OPTIONS') return next()

      if (req && req.body && req.body.operationName == 'IntrospectionQuery')
        return next()

      const moduleName =
        this.controller.moduleMap[
          req.body.operationName || req.url.replace('/', '')
        ]

      if (!moduleName) return next()

      const trace = this.monitor.log(
        'Request',
        {
          operation: req.body.operationName,
          user: req.user && req.user.user && req.user.user._id,
          ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          module: moduleName
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
      this.monitor.log('Server ready', 'Start up', {
        name: config.get('name'),
        date: new Date().toLocaleDateString()
      })
      console.log(`🚀 ${config.get('name')} Server READY at ${host}:${port} `)
    })

    return this.server
  }
}

module.exports = Microservice
