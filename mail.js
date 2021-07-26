const nodemailer = require('nodemailer')
const request = require('request')

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

    const webConfig = config.get(null, 'web')
    this.baseUrl =
      webConfig && webConfig.url
        ? webConfig.url
        : 'http://localhost:' + webConfig.port

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
        request(
          this.baseUrl,
          { qs: { vr: 'email', template, ...data } },
          (err, res) => {
            if (err || !res.body) {
              const message = `📧 Mail template not found ${template}`
              console.error(message)
              return reject(new Error(message))
            }

            let subjectTag = res.body.match(/SUBJECT_.*_SUBJECT/)
            subjectTag =
              (subjectTag && subjectTag[0]) ||
              `SUBJECT_${config.get('mail')}_SUBJECT`

            const subject = subjectTag
              .replace('SUBJECT_', '')
              .replace('_SUBJECT', '')

            let bodyTag = res.body.match(/BODY_.*_BODY/)
            bodyTag =
              (bodyTag && bodyTag[0]) || `BODY_${config.get('mail')}_BODY`

            let body = bodyTag.replace('BODY_', '').replace('_BODY', '')

            this.transport
              .sendMail({
                from: this.from,
                to,
                subject,
                html: body.replace(subjectTag, '')
              })
              .then(() => resolve())
              .catch((err) => {
                console.error('MAIL ERROR!', err)
                return reject(err)
              })
          }
        )
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
