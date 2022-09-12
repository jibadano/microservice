const { gql, ApolloError } = require('apollo-server')
const { print } = require('graphql')
const axios = require('axios').default
const ms = require('..')
const config = require('@jibadano/config')

const typeDefs = gql`
  extend type Query {
    deployStatus: String @auth
    deployments: [Deployment] @auth(requires: USER)
  }
  extend type Mutation {
    startDeploy(_id: ID): Deployment @auth(requires: USER)
  }

  type Deployment {
    _id: ID
    date: String
    settings: Settings
    status: String
    desc: String
  }
`

const vercelDeployV2 = () => {
  const urls = config.get('vercel.deploy.hooks') || []
  urls.forEach((url) => {
    axios.get(url)
  })
}

const vercelStatusV2 = async (timeout = 32000) =>
  new Promise((resolve) => {
    setTimeout(async () => {
      if (await checkVercelDeployStatusV2()) {
        resolve(true)
      } else {
        resolve(await vercelStatusV2(parseInt(timeout / 2)))
      }
    }, timeout)
  })

const checkVercelDeployStatusV2 = async () => {
  const urls = config.get('vercel.deploy.status') || []
  const promises = []
  urls.forEach((url) => {
    promises.push(
      new Promise((resolve, reject) => {
        axios
          .get(url, {
            headers: {
              Authorization: 'Bearer ' + config.get('vercel.deploy.token')
            }
          })
          .then(({ data }) => {
            let status = 'BUILDING'
            if (data && data.deployments && data.deployments.length)
              status = data.deployments.shift().state

            return resolve(status)
          })
          .catch(reject)
      })
    )
  })

  const deploymentStatuses = await Promise.all(promises)
  return deploymentStatuses.every((status) => status == 'READY')
}

const resolvers = {
  Query: {
    deployStatus: () =>
      ms.model.Config.findOne({ _id: 'settings' })
        .select('status')
        .exec()
        .then((settings) => settings.toObject().status),
    deployments: () => ms.model.Deployment.find().sort('-date').exec()
  },
  Mutation: {
    startDeploy: async (_, { _id }) => {
      let settings
      if (_id) {
        const existingDeployment = await ms.model.Deployment.findOne({
          _id
        }).exec()
        if (!existingDeployment) return new ApolloError('deployment not found')

        settings = await ms.model.Config.findOneAndUpdate(
          { _id: 'settings' },
          { $set: { settings, status: 'info' } },
          { new: true }
        ).exec()
      } else {
        settings = await ms.model.Config.findOneAndUpdate(
          { _id: 'settings' },
          { $set: { status: 'info' } },
          { new: true }
        ).exec()
      }

      const deployment = await new ms.model.Deployment({
        settings
      }).save()

      const REFRESH_SETTINGS = gql`
        mutation refreshSettings {
          refreshSettings
        }
      `

      const serviceNames = config.get('services') || []
      const promises = []
      serviceNames.forEach((serviceName) =>
        promises.push(
          new Promise((resolve, reject) => {
            axios
              .post(config.get(`..services.${serviceName}.url`) + '/graphql', {
                operationName: 'refreshSettings',
                query: print(REFRESH_SETTINGS)
              })
              .then(resolve)
              .catch(reject)
          })
        )
      )

      await vercelDeployV2()
      deployment.status = 'info'
      await deployment.save()
      const done = await vercelStatusV2()
      deployment.status = done ? 'ok' : 'error'

      await Promise.all(promises)
      await Config.findOneAndUpdate(
        { _id: 'settings' },
        { $set: { status: deployment.status } }
      ).exec()

      Deployment.find()
        .sort('-date')
        .skip(config.get('deploy.max') || 32)
        .exec()
        .then(
          (deployments) =>
            deployments &&
            deployments.length &&
            Deployment.deleteMany({
              _id: { $in: deployments.map(({ _id }) => _id) }
            })
        )

      await deployment.save()

      return deployment
    }
  }
}

module.exports = { typeDefs, resolvers }
