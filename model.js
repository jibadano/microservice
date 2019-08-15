const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

module.exports = class Model {
  constructor(config) {
    console.info(`🌎 Model init`)
    const modelPath = config.get('model.path') || 'src/model'
    mongoose
      .connect(config.get('mongo'), { useNewUrlParser: true })
      .then(() => console.info(`🌎 Model db connected`))
      .catch(console.error)

    const modelDir = process.env.PWD + '/' + modelPath
    console.info(`🌎 Model reading from ${modelDir}`)
    fs.readdirSync(modelDir).forEach(schemaFile => {
      if (schemaFile !== 'index.js') {
        const schema = require(path.resolve(`${modelDir}/${schemaFile}`))
        let schemaName = schemaFile.replace('.js', '')
        schemaName = schemaName.charAt(0).toUpperCase() + schemaName.slice(1)
        this[schemaName] = mongoose.model(schemaName, schema)
        console.info(`🌎 Model loaded ${schemaFile}`)
      }
    })
    console.info(`🌎 Model init done`)
  }
}
