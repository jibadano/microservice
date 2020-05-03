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
    try {
      const values = require(path.resolve('default.json'))
      this.setConfig(values)
    } catch (e) {}

    if (typeof config === 'string') this.remoteUrl = config
    else if (config instanceof Object) this.setConfig(config)
  }

  get(param) {
    const key = env + (param ? `.${this.moduleName}.${param}` : '')
    const value = get(this.values, key)

    return value
  }

  async refresh() {
    if (!this.remote && this.remoteUrl) {
      mongoose
        .connect(this.remoteUrl, { useNewUrlParser: true })
        .catch((e) => console.error)
      this.remote = mongoose.model(
        'Config',
        new mongoose.Schema({
          development: Object,
          staging: Object,
          production: Object
        })
      )
    }

    if (this.remote) {
      const conf = await this.remote.findOne().exec().catch(console.error)
      this.setConfig(conf)
    }

    return true
  }

  async init() {
    await this.refresh()
  }

  setConfig(values) {
    if (!values) return null
    const mergePolicy = (objValue, srcValue) =>
      typeof objValue == 'object'
        ? merge(objValue, srcValue, mergePolicy)
        : objValue

    for (let env of environments) {
      if (values[env]) {
        let def = values[env].default
        if (def)
          for (let mod in values[env]) {
            if (mod != 'default') {
              const modConfig = values[env][mod]
              values[env][mod] = merge(modConfig, def, mergePolicy)
            }
          }
      }
    }

    values.lastModified = new Date()
    values.version = packageVersion
    console.info(
      `🎛 Config READY ${this.moduleName} ${env} ${values.lastModified}`
    )

    this.values = values
  }
}
