const fs = require('fs')
const path = require('path')

module.exports = class context {
  constructor(config) {
    console.info(`🕹 context init`)
    const contextPath = config.get('context.path') || 'src/context'

    this.handlers = []

    const contextDir = process.env.PWD + '/' + contextPath
    console.info(`🕹 context reading from ${contextDir}`)
    fs.readdirSync(contextDir).forEach(contextFile => {
      const contextName = contextFile.replace('.js', '')

      if (contextFile !== 'index.js') {
        const context = require(path.resolve(`${contextDir}/${contextFile}`))

        if (typeof context === 'function')
          this.handlers.push({
            name: contextName,
            handler: context
          })

        console.info(`🕹 context loaded ${contextFile}`)
      }
    })

    console.info(`🕹 context init done`)
  }
}
