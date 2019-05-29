require('dotenv').config()
const config = require('./config')
const express = require('express')
const bodyParser = require('body-parser')
const jwt = require('express-jwt')
const { ApolloServer } = require('apollo-server-express')
const services = require('./services')

const app = express()
app.use(bodyParser.json())
const jwtOptions = config.get('jwt.options')
if (jwtOptions)
  app.use(jwt(jwtOptions))

const server = new ApolloServer(services)
server.createGraphQLServerOptions = req => ({
  schema: server.schema,
  context: { session: req.user }
})
server.applyMiddleware({ app, path: config.get('graphql.path') })

app.listen(config.get("port"), config.get("host"), () => {
  console.log(`🚀  Server ready at ${config.get("host")}:${config.get("port")} `)
})
