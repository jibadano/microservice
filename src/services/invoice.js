const { gql, ApolloError } = require('apollo-server')
const { Invoice, User } = require('../model')

exports.typeDefs = gql`
  extend type Query {
    invoices: [Invoice]
  }

  extend type Mutation {
    addInvoice(_id:ID!): Invoice,
    generateInvoice(name: String!, address: String, date:String, idNumber:String, products:[InputProduct]): Invoice
  }

  type Invoice {
    _id: ID
    name: String,
    user: String,
    address: String,
    idNumber: String,
    products: [Product],
    date: String
  }

  type Product {
    quantity: Int,
    desc: String,
    price: Float
  }

  input InputProduct {
    quantity: Int,
    desc: String,
    price: Float
  }

`

exports.resolvers = {
  Query: {
    invoices: (_, __, { session }) => Invoice.find({ customer: session.user._id })
      .sort('-date')
      .limit(10)
      .exec()
  },
  Mutation: {
    addInvoice: async (_, args, { session }) => Invoice.findOneAndUpdate(args, { $set: { customer: session.user._id } }, { new: true }).exec(),
    generateInvoice: (_, args, { session }) => new Invoice({ ...args, user: session.user._id }).save(),

  }
}
