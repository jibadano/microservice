const fs = require('fs')
const path = require('path')

module.exports = class Context {
  constructor(config) {
    const contextPaths = config.get('selectedServices')

    this.handlers = []

    try {
      contextPaths.forEach((contextPath) => {
        const contextDir = './' + contextPath + '/context'
        fs.readdirSync(contextDir).forEach((contextFile) => {
          const contextName = contextFile.replace('.js', '')

          if (contextFile !== 'index.js') {
            const context = require(path.resolve(
              `${contextDir}/${contextFile}`
            ))

            if (typeof context === 'function')
              this.handlers.push({
                name: contextName,
                handler: context
              })
          }
        })
      })
    } catch (e) {}

    this.handlers.length &&
      console.info(
        `📰Context  READY ${this.handlers.map((h) => `\n\t${h.name}`)}`
      )
  }
}
