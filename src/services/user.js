const { gql } = require('apollo-server')
const { User } = require('../model')

exports.typeDefs = gql`
  extend type Query {
    user(_id:ID): User
  }

  type User {
    _id: ID!
  }
`

exports.resolvers = {
  Query: {
    user: (_, { _id }) => User.findOne({ _id }).exec(),
  }
}