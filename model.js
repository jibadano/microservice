const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

const getSchemaName = (schemaFile) => {
  let schemaName = schemaFile.replace('.js', '')

  schemaName = schemaName.charAt(0).toUpperCase() + schemaName.slice(1)

  return schemaName
}
module.exports = class Model {
  constructor(config) {
    const modelPaths = config.get('selectedServices')
    const modelConnection = mongoose.createConnection(config.get('mongo'), {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    const schemas = []
    try {
      fs.readdirSync(__dirname + '/model').forEach((schemaFile) => {
        const schema = require(__dirname + '/model/' + schemaFile)
        let schemaName = getSchemaName(schemaFile)
        this[schemaName] = modelConnection.model(schemaName, schema)
        schemas.push(schemaName)
      })

      modelPaths.forEach((modelPath) => {
        const modelDir = './' + modelPath + '/model'
        fs.readdirSync(modelDir).forEach((schemaFile) => {
          if (schemaFile !== 'index.js') {
            const schema = require(path.resolve(`${modelDir}/${schemaFile}`))
            let schemaName = getSchemaName(schemaFile)
            this[schemaName] = modelConnection.model(schemaName, schema)
            schemas.push(schemaName)
          }
        })
      })
    } catch (e) {
      console.error(e)
    }
    schemas.length &&
      console.info(`🌎Model READY ${schemas.map((s) => `\n\t${s}`)}`)
  }
}
