const mongoose = require('mongoose')
const get = require('lodash/get')
const env = process.env.NODE_ENV || 'development'
const path = require('path')

module.exports = class Config {
	constructor(config, name = 'default') {
		this.name = name
		try {
			this.values = require(path.resolve('default.json'))
		} catch (e) { }

		if (config instanceof String)
			try {
				mongoose.connect(config);
				this.remote = mongoose.model('Config', new mongoose.Schema())
			} catch (e) {
				console.log(e)
			}
		else if (config instanceof Object)
			this.values = config

	}

	get(param) {
		const key = env + (param ? `.${this.name}.${param}` : '')
		return get(this.values, key)
	}

	async refresh() {
		if (this.remote)
			values = await this.remote.find().exec()

		return true
	}
}