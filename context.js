const fs = require('fs')
const path = require('path')
const DEFAULT_PATH = 'src/context'
module.exports = class Context {
  constructor(config) {
    const contextPath = config.get('context.path') || DEFAULT_PATH

    this.handlers = []

    const contextDir = process.env.PWD + '/' + contextPath
    try {
      fs.readdirSync(contextDir).forEach((contextFile) => {
        const contextName = contextFile.replace('.js', '')

        if (contextFile !== 'index.js') {
          const context = require(path.resolve(`${contextDir}/${contextFile}`))

          if (typeof context === 'function')
            this.handlers.push({
              name: contextName,
              handler: context
            })
        }
      })
    } catch (e) {}

    this.handlers.length &&
      console.info(
        `📰Context  READY ${this.handlers.map((h) => `\n\t${h.name}`)}`
      )
  }
}
