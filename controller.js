const fs = require('fs')
const { gql } = require('apollo-server')
const path = require('path')

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

    const controllerDir = process.env.PWD + '/' + servicesPath
    console.info(`🕹 Controller reading from ${controllerDir}`)
    fs.readdirSync(controllerDir).forEach(serviceFile => {
      if (serviceFile !== 'index.js') {
        const service = require(path.resolve(`${controllerDir}/${serviceFile}`))
        this.typeDefs.push(service.typeDefs)
        this.resolvers.push(service.resolvers)
        console.info(`🕹 Controller loaded ${serviceFile}`)
      }
    })
    console.info(`🕹 Controller init done`)
  }
}
