const { gql, ApolloError } = require('apollo-server')
const { print } = require('graphql')
const fetch = require('node-fetch')
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
    fetch(url, { method: 'get' })
  })
}

const vercelStatusV2 = async (timeout = 128000) =>
  new Promise((resolve) => {
    setTimeout(async () => {
      if (timeout <= 2000) return resolve(false)
      if (await checkVercelDeployStatusV2()) {
        resolve(true)
      } else {
        resolve(await vercelStatusV2(parseInt(timeout / 2)))
      }
    }, timeout)
  })

const checkVercelDeployStatusV2 = async () => {
  const urls = config.get('vercel.deploy.status') || []
  if (!urls.length) return true

  const promises = []
  urls.forEach((url) => {
    promises.push(
      new Promise((resolve, reject) => {
        fetch(url, {
          method: 'get',
          headers: {
            Authorization: 'Bearer ' + config.get('vercel.deploy.token')
          }
        })
          .then((res) => res.json())
          .then((data) => {
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
            fetch(config.get(`..services.${serviceName}.url`) + '/graphql', {
              method: 'post',
              body: JSON.stringify({
                operationName: 'refreshSettings',
                query: print(REFRESH_SETTINGS)
              }),
              headers: {
                'Content-Type': 'application/json'
              }
            })
              .then(resolve)
              .catch(reject)
          })
        )
      )

      vercelDeployV2()
      vercelStatusV2().then(async (done) => {
        deployment.status = done ? 'ok' : 'error'
        await Promise.all(promises)
        await ms.model.Config.findOneAndUpdate(
          { _id: 'settings' },
          { $set: { status: deployment.status } }
        ).exec()
        await deployment.save()
      })

      ms.model.Deployment.find()
        .sort('-date')
        .skip(config.get('deploy.max') || 32)
        .exec()
        .then(
          (deployments) =>
            deployments &&
            deployments.length &&
            ms.model.Deployment.deleteMany({
              _id: { $in: deployments.map(({ _id }) => _id) }
            })
        )

      await deployment.save()

      return deployment
    }
  }
}

module.exports = { typeDefs, resolvers }
