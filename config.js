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

  async refresh() {
    if (!this.remote && this.remoteUrl) {
      const configConnection = mongoose.createConnection(this.remoteUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      })
      this.remote = configConnection.model(
        'Config',
        new mongoose.Schema({
          development: Object,
          staging: Object,
          production: Object
        })
      )
      this.remoteSettings = configConnection.model(
        'Setting',
        new mongoose.Schema({
          _id: String,
          value: Object
        })
      )
    }

    if (this.remote) {
      const configData = await this.remote
        .findOne()
        .select(env)
        .exec()
        .then((c) => c[env])
        .catch(console.error)
      this.setConfig(configData)
    }

    if (this.remoteSettings) {
      const settings = await this.remoteSettings
        .find()
        .exec()
        .catch(console.error)
      this.setSettings(settings)
    }

    return true
  }

  async init() {
    await this.refresh()
  }

  setSettings(newSettings = []) {
    const settings = {}
    for (let setting of newSettings) settings[setting._id] = setting.value

    this.values.settings = settings
  }

  get(param, moduleName = this.moduleName) {
    const key = param ? `.${moduleName}.${param}` : ''
    const value = get(this.values, key)

    return value
  }

  setConfig(values = {}) {
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

    values[this.moduleName].lastModified = new Date().toISOString()
    values[this.moduleName].version = packageVersion
    console.info(
      `🎛 Config READY ${this.moduleName} ${env} ${new Date().toISOString()}`
    )

    this.values = values
  }
}
