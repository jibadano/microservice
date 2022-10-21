const nodemailer = require('nodemailer')
const fetch = require('node-fetch')
const URLSearchParams = require('url').URLSearchParams

module.exports = class Mail {
  constructor(config) {
    if (!config.get('mail')) {
      this.send = () => console.error(`📧Mail  ERROR Not implemented`)
      return
    }

    this.from = {
      name: config.get('mail.from') || config.get('name'),
      address: config.get('mail.user')
    }

    const webConfig = config.get('..apps.web')
    this.baseUrl = webConfig.url

    const transportConfig = config.get('mail.service') || { service: 'gmail' }
    this.transport = nodemailer.createTransport({
      ...transportConfig,
      auth: {
        user: config.get('mail.user'),
        pass: config.get('mail.pass')
      }
    })

    this.send = (to, template, data = {}) => {
      if (!to || !template)
        return console.error(`📧 Mail to or template name not provided`)
      return new Promise((resolve, reject) => {
        fetch(
          this.baseUrl +
            '?' +
            new URLSearchParams({ vr: 'email', template, ...data }),
          { method: 'get' }
        )
          .then((res) => res.text())
          .then((body) => {
            let subjectTag = body.match(/SUBJECT_.*_SUBJECT/)
            subjectTag = subjectTag && subjectTag[0]

            if (!subjectTag) return reject(new Error('Subject not found'))

            const subject = subjectTag
              .replace('SUBJECT_', '')
              .replace('_SUBJECT', '')

            const start = body.indexOf('BODY_')
            const end = body.indexOf('_BODY')
            if (start == -1 || end == -1)
              return reject(new Error('Body not found'))

            let html = body.slice(start + 5, end)

            this.transport
              .sendMail({
                from: this.from,
                to,
                subject,
                html
              })
              .then(() => resolve())
              .catch((err) => {
                console.error('MAIL ERROR!', err)
                return reject(err)
              })
          })
          .catch((e) => {
            const message = `📧 Mail template not found ${template}`
            console.error(message, e)
            return reject(new Error(message))
          })
      })
    }

    this.sendPlain = (to, subject, text) => {
      if (!to || !text) return console.error(`📧 Mail to or text not provided`)

      this.transport
        .sendMail({
          from: this.from,
          to,
          subject,
          text
        })
        .catch((err) => console.log('ERROR MAIL!!', err))
    }
    console.info(`📧Mail  READY`)
  }
}
