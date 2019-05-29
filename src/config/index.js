const mongoose = require('mongoose')
const get = require('lodash/get')
const env = process.env.NODE_ENV || 'development'
let values = {}
try {
    values = require('./default.json')
} catch (e) { }

let Config
if (process.env.CONFIG_URL) {
    try {
        mongoose.connect(process.env.CONFIG_URL);
        Config = mongoose.model('Config', new mongoose.Schema())
    } catch (e) {
        console.log(e)
    }
}

const refresh = async () => {
    if (Config)
        values = await Config.find().exec()

    return true
}

const getConfig = param => {
    const key = `${env}.${param}`
    return get(values, key)
}

module.exports = { get: getConfig, refresh }