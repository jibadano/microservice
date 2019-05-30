const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
module.exports = class Model {
    constructor(config) {
        mongoose.connect(config.get('mongo'));
        const modelDir = config.get('model.path')
        this.model = {}
        fs.readdirSync(modelDir).forEach(schemaFile => {
            if (schemaFile !== 'index.js') {
                const schema = require(path.resolve(`${modelDir}/${schemaFile}`))
                let schemaName = schemaFile.replace('.js', '')
                schemaName = schemaName.charAt(0).toUpperCase() + schemaName.slice(1)
                this.model[schemaName] = mongoose.model(schemaName, schema)
            }
        })
    }
}