const fs = require('fs')
const { gql } = require('apollo-server')
const path = require('path')
module.exports = class Controller {
  constructor(config) {
    this.typeDefs = [
      gql`
        type Query {
          version: String
        }

        type Mutation {
          refreshConfig: Boolean
        }
      `]

    this.resolvers = [
      {
        Query: {
          version: () => config.get('version')
        },
        Mutation: {
          refreshConfig: () => config.refresh()
        },
      }
    ]
    const controllerDir = config.get('services.path')
    fs.readdirSync(controllerDir).forEach(serviceFile => {
      if (serviceFile !== 'index.js') {
        const service = require(path.resolve(`${controllerDir}/${serviceFile}`))
        this.typeDefs.push(service.typeDefs)
        this.resolvers.push(service.resolvers)
      }
    })
  }

}