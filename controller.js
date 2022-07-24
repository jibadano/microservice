const fs = require('fs')
const { gql } = require('apollo-server')
const path = require('path')

module.exports = class Controller {
  constructor(config) {
    const servicesPaths = config.get('selectedServices')
    this.typeDefs = [
      gql`
        type Query {
          version: String
        }

        type Mutation {
          refreshSettings: Boolean
        }

        scalar Date
        scalar LocalizedString
      `
    ]

    this.resolvers = [
      {
        Query: {
          version: () => config.get('version')
        },
        Mutation: {
          refreshSettings: () => config.refreshSettings()
        }
      }
    ]

    this.routes = []
    this.schemaDirectives = {}
    this.graphqlServices = []

    fs.readdirSync(__dirname + '/services').forEach((serviceFile) => {
      this.processService(
        __dirname + '/services/' + serviceFile,
        serviceFile.replace('.js', '')
      )
    })

    servicesPaths.forEach((servicesPath) => {
      const serviceDir = './' + servicesPath + '/services'
      fs.readdirSync(serviceDir).forEach((serviceFile) => {
        if (serviceFile !== 'index.js')
          this.processService(
            path.resolve(`${serviceDir}/${serviceFile}`),
            serviceFile.replace('.js', '')
          )
      })
    })

    console.info(
      `🕹 Controller READY  ${this.routes.map(
        (r) => `\n\t${r.path}  ${r.method}`
      )} ${this.graphqlServices.map((s) => `\n\tgraphql ${s}`)}`
    )
  }

  processService(servicePath, serviceName) {
    const service = require(servicePath)

    if (service.directives) {
      this.schemaDirectives = {
        ...this.schemaDirectives,
        ...service.directives
      }
    }

    if (service.typeDefs && service.resolvers) {
      this.typeDefs.push(service.typeDefs)
      this.resolvers.push(service.resolvers)
      this.graphqlServices.push(serviceName)
    } else if (typeof service === 'function')
      this.routes.push({
        method: 'all',
        path: `/${serviceName}`,
        handler: service
      })

    const methods = Object.keys(service)
    methods.forEach((method) => {
      if (['get', 'post', 'put', 'delete', 'all'].includes(method))
        this.routes.push({
          method,
          path: `/${serviceName}`,
          handler: service[method]
        })
    })
  }
}
