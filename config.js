const mongoose = require('mongoose')
const get = require('lodash/get')
const merge = require('lodash/mergeWith')

const environments = ['development', 'staging', 'production']

if (process.env.NODE_ENV && !environments.includes(process.env.NODE_ENV))
  console.warn(`🎛 Config ${process.env.NODE_ENV} environment not available`)

const env = process.env.NODE_ENV || 'development'

const path = require('path')
const package = require(path.resolve('package.json'))
const packageName = get(package, 'name')
const packageVersion = get(package, 'version')

module.exports = class Config {
  constructor(config, moduleName = packageName) {
    this.moduleName = moduleName
    this.values = {}
    try {
      const values = require(path.resolve('default.json'))
      this.setConfig(values)
    } catch (e) {}

    if (typeof config === 'string') this.remoteUrl = config
    else if (config instanceof Object) this.setConfig(config)
  }

  async init() {
    if (!this.remote && this.remoteUrl) {
      const configConnection = mongoose.createConnection(this.remoteUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      })
      this.remote = configConnection.model(
        'Config',
        mongoose.Schema.Types.Mixed
      )
    }

    if (this.remote) {
      const configList = await this.remote.find().exec().catch(console.error)

      const mainConfig = configList.find(({ _id }) => _id == 'main')
      const settingsConfig = configList.find(({ _id }) => _id == 'settings')
      this.setConfig(mainConfig)
      this.setSettings(settingsConfig)
    }

    return true
  }

  get(param, moduleName = this.moduleName) {
    const key = param ? `${moduleName}.${param}` : moduleName

    return get(this.values, key)
  }

  setConfig(values = {}) {
    delete values._id
    const mergePolicy = (objValue, srcValue) =>
      typeof objValue == 'object'
        ? merge(objValue, srcValue, mergePolicy)
        : objValue

    let def = values.default
    if (def)
      for (let mod in values) {
        if (mod != 'default') {
          const modConfig = values[mod]
          values[mod] = merge(modConfig, def, mergePolicy)
        }
      }

    if (!values[this.moduleName]['url']) {
      let url = values[this.moduleName]['host'] || 'http://localhost'
      url += values[this.moduleName]['port'] || ''
      values[this.moduleName]['url'] = url
    }

    values[this.moduleName].lastModified = new Date().toISOString()
    values[this.moduleName].version = packageVersion
    console.info(
      `🎛 Config READY ${this.moduleName} ${env} ${new Date().toISOString()}`
    )

    this.values = values
  }

  async refreshSettings() {
    if (this.remote) {
      const settingsConfig = await this.remote
        .findOne({ _id: 'settings' })
        .exec()
        .catch(console.error)

      this.setSettings(settingsConfig)
    }
    return true
  }

  setSettings(settings = {}) {
    delete settings._id
    this.values[this.moduleName].settings = settings
  }
}
