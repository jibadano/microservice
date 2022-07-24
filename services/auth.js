const { gql, AuthenticationError } = require('apollo-server')
const { SchemaDirectiveVisitor } = require('apollo-server-express')
const { defaultFieldResolver } = require('graphql')
const ms = require('..')
const crypto = require('crypto')
const config = require('@jibadano/config')

const validate = ({ password, hash, salt }) =>
  hash ==
  crypto
    .createHash(config.get('login.algorithm'))
    .update(password + salt)
    .digest('hex')

const generate = ({ _id, password }) => {
  const salt = crypto.randomBytes(config.get('login.saltBytes')).toString()
  const hash = crypto
    .createHash(config.get('login.algorithm'))
    .update(password + salt)
    .digest('hex')
  return { _id, username: _id, hash, salt }
}

const ROLES = {
  GUEST: 0,
  USER: 1,
  ADMIN: 2
}

const isAuthorized = (role, requiredRole) => ROLES[requiredRole] <= ROLES[role]

class AuthDirective extends SchemaDirectiveVisitor {
  visitObject(type) {
    this.ensureFieldsWrapped(type)
    type._requiredAuthRole = this.args.requires
  }
  // Visitor methods for nested types like fields and arguments
  // also receive a details object that provides information about
  // the parent and grandparent types.
  visitFieldDefinition(field, details) {
    this.ensureFieldsWrapped(details.objectType)
    field._requiredAuthRole = this.args.requires
  }

  ensureFieldsWrapped(objectType) {
    // Mark the GraphQLObjectType object to avoid re-wrapping:
    if (objectType._authFieldsWrapped) return
    objectType._authFieldsWrapped = true

    const fields = objectType.getFields()

    Object.keys(fields).forEach((fieldName) => {
      const field = fields[fieldName]
      const { resolve = defaultFieldResolver } = field
      field.resolve = async function (...args) {
        // Get the required Role from the field first, falling back
        // to the objectType if no Role is required by the field:
        const requiredRole =
          field._requiredAuthRole || objectType._requiredAuthRole

        if (!requiredRole) {
          return resolve.apply(this, args)
        }

        const context = args[2]
        if (
          !context.session ||
          !context.session.user ||
          !isAuthorized(context.session.user.role, requiredRole)
        )
          throw new AuthenticationError('Session required')

        return resolve.apply(this, args)
      }
    })
  }
}

const directives = {
  auth: AuthDirective
}

const typeDefs = gql`
  enum Role {
    GUEST
    USER
    ADMIN
  }

  scalar Token

  directive @auth(requires: Role = USER) on OBJECT | FIELD_DEFINITION

  extend type Query {
    token: Token
  }

  extend type Mutation {
    login(_id: ID, password: String, remember: Boolean): Token
    signup(_id: ID!, password: String!, role: Role): Credential
  }
`

const resolvers = {
  Query: {
    token: (_, __, context) => {
      if (!context || !context.session || !context.session.user) return null

      delete context.session.exp
      delete context.session.iat
      return ms.sign(context.session)
    }
  },
  Mutation: {
    login: async (_, { _id, password, remember }) => {
      const user = await ms.model.Credential.findOne({ _id }).exec()

      if (!user) return new ApolloError('User not found')
      if (user.inactive) return new ApolloError('User is inactive')

      user.password = password
      if (!validate(user)) return new ApolloError('Password is invalid')

      return ms.sign(
        { user: { _id: user._id, role: user.role } },
        remember ? { expiresIn: '1y' } : null
      )
    },
    signup: (_, { _id, password, role = 'USER' }) => {
      const credential = generate({ _id, password })
      return new ms.model.Credential({ ...credential, role }).save()
    },
    updatePassword: (_, { _id, password }) => {
      const credential = password ? generate({ _id, password }) : { _id }

      return ms.model.Credential.findOneAndUpdate(
        { _id },
        { ...credential },
        { new: true }
      )
        .select('_id role createdAt')
        .exec()
    }
  }
}

const all = (req, res) => {
  if (!req.headers.authorization) return res.end()

  const token = req.headers.authorization.replace('Bearer ', '')

  const session = ms.verify(token)
  if (!session || !session.user) return res.end()

  delete session.exp
  delete session.iat
  res.end(ms.sign(session))
}

module.exports = { typeDefs, resolvers, directives, all }
