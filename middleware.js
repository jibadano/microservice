const fs = require('fs')
const path = require('path')
const DEFAULT_PATH = 'src/middleware'

module.exports = class Middleware {
  constructor(config) {
    const middlewarePath = config.get('middleware.path') || DEFAULT_PATH

    this.list = []
    const middlewareDir = process.env.PWD + '/' + middlewarePath
    try {
      fs.readdirSync(middlewareDir).forEach((middlewareFile) => {
        if (middlewareFile !== 'index.js') {
          const middleware = require(path.resolve(
            `${middlewareDir}/${middlewareFile}`
          ))

          if (middleware instanceof Array)
            this.list = this.list.concat(middleware)
          else if (middleware) this.list.push(middleware)
        }
      })
    } catch (e) {
      console.error(`🔗 Middleware  ERROR ${e}`)
    }

    this.list.length && console.info(`🔗 Middleware READY ${this.list}`)
  }
}
