const fs = require('fs')
const path = require('path')

module.exports = class Middleware {
  constructor(config) {
    console.info(`🕹 middleware init`)
    const middlewarePath = config.get('middleware.path') || 'src/middleware'

    this.list = []

    const middlewareDir = process.env.PWD + '/' + middlewarePath
    console.info(`🕹 middleware reading from ${middlewareDir}`)
    try {
      fs.readdirSync(middlewareDir).forEach(middlewareFile => {
        if (middlewareFile !== 'index.js') {
          const middleware = require(path.resolve(
            `${middlewareDir}/${middlewareFile}`
          ))

          if (middleware instanceof Array)
            this.list = this.list.concat(middleware)
          else if (!middleware) this.list.push(middleware)

          console.info(`🕹 middleware loaded ${middlewareFile}`)
        }
      })
    } catch (e) {
      console.info(`🕹 middleware not loaded ${e}`)
    }

    console.info(`🕹 middleware init done`)
  }
}
