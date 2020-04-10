const fs = require('fs')
const { gql, AuthenticationError } = require('apollo-server')
const path = require('path')
const { SchemaDirectiveVisitor } = require('apollo-server-express')

class AuthDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve } = field

    field.resolve = (...args) => {
      const [, , context] = args
      if (!context.session || !context.session.user)
        throw new AuthenticationError('Session required')
      else return resolve.apply(this, args)
    }
  }
}

module.exports = class Controller {
  constructor(config) {
    console.info(`🕹 Controller init`)
    const servicesPath = config.get('services.path') || 'src/services'
    this.typeDefs = [
      gql`
        type Query {
          version: String
        }

        type Mutation {
          refreshConfig: Boolean
        }
      `
    ]

    this.resolvers = [
      {
        Query: {
          version: () => config.get('version')
        },
        Mutation: {
          refreshConfig: () => config.refresh()
        }
      }
    ]

    this.routes = []
    this.schemaDirectives = {
      auth: AuthDirective
    }

    const controllerDir = process.env.PWD + '/' + servicesPath
    console.info(`🕹 Controller reading from ${controllerDir}`)
    fs.readdirSync(controllerDir).forEach((serviceFile) => {
      if (serviceFile !== 'index.js') {
        const service = require(path.resolve(`${controllerDir}/${serviceFile}`))
        const serviceName = serviceFile.replace('.js', '')
        if (service.typeDefs && service.resolvers) {
          this.typeDefs.push(service.typeDefs)
          this.resolvers.push(service.resolvers)
        }

        if (typeof service === 'function')
          this.routes.push({
            method: 'all',
            path: `/${serviceName}`,
            handler: service
          })
        else {
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

        console.info(`🕹 Controller loaded ${serviceFile}`)
      }
    })

    console.info(`🕹 Controller init done`)
  }
}
