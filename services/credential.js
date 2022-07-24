const { gql } = require('apollo-server')
const ms = require('..')

const typeDefs = gql`
  extend type Query {
    exists(_id: ID): Boolean
    credentials: [Credential] @auth
    credential(_id: ID!): Credential @auth
    role: Role @auth
  }
  extend type Mutation {
    removeCredential(_id: ID!): Credential @auth(requires: ADMIN)
    updateCredential(_id: ID!, role: Role): Credential @auth(requires: ADMIN)
  }

  type Credential {
    _id: ID
    role: Role
    createdAt: Date
  }
`

const resolvers = {
  Query: {
    exists: (_, { _id }) =>
      ms.model.Credential.findOne({ _id })
        .select('_id')
        .exec()
        .then((cred) => Boolean(cred)),
    credentials: () =>
      ms.model.Credential.find({ inactive: { $ne: true } })
        .select('_id role createdAt')
        .exec(),
    credential: (_, credential) =>
      ms.model.Credential.findOne(credential)
        .select('_id role createdAt')
        .exec(),
    role: (_, __, { session }) =>
      ms.model.Credential.findOne({ _id: session.user._id })
        .select('role')
        .exec()
        .then((credential) => (credential ? credential.role : null))
  },
  Mutation: {
    updateCredential: (_, { _id, role }) => {
      return ms.model.Credential.findOneAndUpdate(
        { _id },
        { role },
        { new: true }
      )
        .select('_id role createdAt')
        .exec()
    },
    removeCredential: (_, credential) =>
      ms.model.Credential.findOneAndRemove(credential)
        .select('_id role createdAt')
        .exec()
  }
}

module.exports = { typeDefs, resolvers }
