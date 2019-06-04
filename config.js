const mongoose = require('mongoose')
const get = require('lodash/get')
const merge = require('lodash/merge')

const env = process.env.NODE_ENV || 'development'
const path = require('path')
const package = require(path.resolve('package.json'))
const packageName = get(package, 'name')

const environments = ["development", "staging", "production"]

module.exports = class Config {
	constructor(config, moduleName = packageName) {
		this.moduleName = moduleName
		try {
			const values = require(path.resolve('default.json'))
			this.setConfig(values)
		} catch (e) { }

		if (typeof config === 'string')
			this.remoteUrl = config
		else if (config instanceof Object)
			this.setConfig(config)
	}

	get(param) {
		const key = env + (param ? `.${this.moduleName}.${param}` : '')
		const value = get(this.values, key)

		if (!value) console.log(`Config value ${key} not found`)

		return value
	}

	async refresh() {
		if (!this.remote && this.remoteUrl) {
			mongoose.connect(this.remoteUrl, { useNewUrlParser: true })
			this.remote = mongoose.model('Config', new mongoose.Schema({ development: Object, staging: Object, production: Object }))
		}

		if (this.remote) {
			const conf = await this.remote.findOne().exec().catch(console.log)
			this.setConfig(conf)
		}

		return true
	}

	async init() {
		await this.refresh()
	}

	setConfig(values) {
		if (!values) return null

		for (let env of environments) {
			if (values[env]) {
				let def = values[env].default
				if (def)
					for (let mod in values[env]) {
						const modConfig = values[env][mod]
						if (mod != 'default')
							values[env][mod] = merge(modConfig, def)
					}
			}
		}
		values.lastModified = new Date()
		this.values = values
	}
}