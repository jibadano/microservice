const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const DEFAULT_PATH = 'src/model'
module.exports = class Model {
  constructor(config) {
    const modelPath = config.get('model.path') || DEFAULT_PATH
    const modelConnection = mongoose.createConnection(config.get('mongo'), {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })

    const modelDir = process.env.PWD + '/' + modelPath
    const schemas = []
    try {
      fs.readdirSync(modelDir).forEach((schemaFile) => {
        if (schemaFile !== 'index.js') {
          const schema = require(path.resolve(`${modelDir}/${schemaFile}`))
          let schemaName = schemaFile.replace('.js', '')
          schemaName = schemaName.charAt(0).toUpperCase() + schemaName.slice(1)
          this[schemaName] = modelConnection.model(schemaName, schema)
          schemas.push(schemaName)
        }
      })
    } catch (e) {
      //ignore
    }
    schemas.length &&
      console.info(`🌎Model READY ${schemas.map((s) => `\n\t${s}`)}`)
  }
}
