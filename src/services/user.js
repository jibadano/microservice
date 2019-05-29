const { gql, AuthenticationError } = require('apollo-server')
const { User, Poll } = require('../model')
const jsonwebtoken = require('jsonwebtoken')
const get = require('lodash/get')
const config = require('../config')
const typeDefs = gql`

  extend type Query {
    user(_id:ID): User
    me: Session
    exists(_id:ID): Boolean
  }

  extend type Mutation {
    login(_id: ID, password:String): Session
    signup(_id: ID!, password: String!, firstName: String, lastName:String, avatar:String): Session
    forgot(_id: ID!): String
    updateUser(_id: ID, password: String, firstName: String, lastName:String, avatar:String): User
    deleteUser(_id: ID): User
  }

  type User {
    _id: ID!
    avatar:String
    firstName: String
    lastName: String
  }

  type Session {
    user: User
    token: String
  }

`

const resolvers = {
  Query: {
    user: async (_, { _id }, { session }) => User.findOne({ _id }).exec(),
    me: (_, __, context) => {
      const user = get(context, 'session.user')
      return user && { user, token: sign(user) }
    },
    exists: (_, args) => User.findOne(args).exec().then(user => Boolean(user))
  },
  Mutation: {
    login: async (_, args) => {
      const user = await User.findOne(args).select("_id").exec()
      if (!user) return new AuthenticationError("Email or password is invalid")
      return { user, token: sign(user) }
    },
    signup: async (_, args) => {
      let user = await new User(args).save()
      if (!user) return null
      return { user, token: sign(user) }
    },
    forgot: (_, args) => { console.log(args) },
    updateUser: (_, { _id, ...update }) => User.updateOne({ _id }, update).exec(),
    deleteUser: (_, args) => User.deleteOne(args).exec(),
  }
}

const sign = user => jsonwebtoken.sign({ user }, config.get('jwt.options.secret'), config.get('jwt.signOptions'))

module.exports = { typeDefs, resolvers }