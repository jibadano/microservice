const fs = require('fs')
const path = require('path')

module.exports = class Middleware {
  constructor(config) {
    const middlewarePaths = config.get('selectedServices')

    this.list = []
    const middlewares = []
    try {
      middlewarePaths.forEach((middlewarePath) => {
        const middlewareDir = './' + middlewarePath + '/middleware'
        fs.readdirSync(middlewareDir).forEach((middlewareFile) => {
          if (middlewareFile !== 'index.js') {
            const middleware = require(path.resolve(
              `${middlewareDir}/${middlewareFile}`
            ))

            if (middleware instanceof Array)
              this.list = this.list.concat(middleware)
            else if (middleware) this.list.push(middleware)

            if (middleware) middlewares.push(middlewareFile.replace('.js', ''))
          }
        })
      })
    } catch (e) {}

    this.list.length &&
      console.info(`🔗Middleware  READY ${middlewares.map((m) => `\n\t${m}`)}`)
  }
}
