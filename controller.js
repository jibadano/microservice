const fs = require('fs')
const { gql, AuthenticationError } = require('apollo-server')
const path = require('path')
const { SchemaDirectiveVisitor } = require('apollo-server-express')

const Roles = {
  GUEST: 0,
  USER: 1,
  ADMIN: 2
}

const isAuthorized = (role, requiredRole) => Roles[requiredRole] <= Roles[role]

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

module.exports = class Controller {
  constructor(config) {
    console.info(`🕹 Controller init`)
    const servicesPath = config.get('services.path') || 'src/services'
    this.typeDefs = [
      gql`
        directive @auth(requires: Role = USER) on OBJECT | FIELD_DEFINITION

        type Query {
          version: String
        }

        type Mutation {
          refreshConfig: Boolean
        }

        enum Role {
          GUEST
          USER
          ADMIN
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
