const { gql, ApolloError } = require('apollo-server')
const { Event, User } = require('../model')

const typeDefs = gql`
  extend type Query {
    events: [Event]
  }

  extend type Mutation {
    addEvent(name: String!, desc: String, date:String): Event
    deleteEvent(_id:ID!): Event
  }

  type Event {
    _id: ID
    name: String,
    image:String,
    desc: String,
    host: ID
    date: String
    guests: [User]
  }

`

const resolvers = {
  Query: {
    events: (_, __, { session }) => Event.find()
      .sort('-date')
      .limit(10)
      .exec()
  },
  Mutation: {
    addEvent: (_, args, { session }) => new Event({ ...args, host: session.user._id }).save(),
    deleteEvent: (_, args, { session }) => Poll.deleteOne({ ...args, host: session.user._id }).exec(),
  }
}

module.exports = { typeDefs, resolvers }