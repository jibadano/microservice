const express = require('express')
const bodyParser = require('body-parser')
const jwt = require('express-jwt')
const { ApolloServer } = require('apollo-server-express')

const Config = require('./config')
const Model = require('./model')
const Controller = require('./controller')

module.exports = class Microservice {
  constructor(config) {
    this.config = new Config(config)
  }

  async init() {
    await this.config.init()
    this.model = new Model(this.config)
    this.controller = new Controller(this.config)

    const host = this.config.get('host') || '0.0.0.0'
    const port = process.env.PORT || this.config.get('port') || 80
    const app = express()

    app.use(bodyParser.json())
    const jwtOptions = this.config.get('jwt.options')
    if (jwtOptions)
      app.use(jwt(jwtOptions))

    const server = new ApolloServer(this.controller)
    server.createGraphQLServerOptions = req => ({
      schema: server.schema,
      context: { session: req.user }
    })
    server.applyMiddleware({ app, path: this.config.get('graphql.path') })

    app.listen(port, host, () => {
      console.info(`🚀  Server ready at ${host}:${port} `)
    })
  }

}