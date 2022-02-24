const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

module.exports = class Model {
  constructor(config) {
    const modelPaths = config.get('services') || [config.get('name')]
    const modelConnection = mongoose.createConnection(config.get('mongo'), {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })

    const schemas = []
    try {
      modelPaths.forEach((modelPath) => {
        const modelDir = './' + modelPath + '/model'
        fs.readdirSync(modelDir).forEach((schemaFile) => {
          if (schemaFile !== 'index.js') {
            const schema = require(path.resolve(`${modelDir}/${schemaFile}`))
            let schemaName = schemaFile.replace('.js', '')
            schemaName =
              schemaName.charAt(0).toUpperCase() + schemaName.slice(1)
            this[schemaName] = modelConnection.model(schemaName, schema)
            schemas.push(schemaName)
          }
        })
      })
    } catch (e) {
      //ignore
    }
    schemas.length &&
      console.info(`🌎Model READY ${schemas.map((s) => `\n\t${s}`)}`)
  }
}
