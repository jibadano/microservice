const fs = require('fs')
const package = require('../../package.json')
const config = require('../config')
const { gql } = require('apollo-server')

const typeDefs = [gql`
  type Query {
    version: String
  }

  type Mutation {
    refreshConfig: Boolean
  }
`]

const resolvers = [
    {
        Query: {
            version: () => package.version
        },
        Mutation: {
            refreshConfig: () => config.refresh()
        },
    }
]

fs.readdirSync(__dirname).forEach(serviceFile => {
    if (serviceFile !== 'index.js') {
        const service = require(`${__dirname}/${serviceFile}`)
        typeDefs.push(service.typeDefs)
        resolvers.push(service.resolvers)
    }
})

module.exports = { typeDefs, resolvers }