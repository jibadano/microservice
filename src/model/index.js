const mongoose = require('mongoose')
const fs = require('fs')
const config = require('../config')
mongoose.connect(config.get('mongo'));

const model = {}

fs.readdirSync(__dirname).forEach(schemaFile => {
    if (schemaFile !== 'index.js') {
        const schema = require(`${__dirname}/${schemaFile}`)
        const schemaName = schemaFile.replace('.js', '')
        model[schemaName] = mongoose.model(schemaName, schema)
    }
})

module.exports = model