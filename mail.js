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

    const webConfig = config.get().web
    this.baseUrl =
      webConfig && webConfig.url
        ? webConfig.url
        : 'http://localhost:' + webConfig.port

    this.transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.get('mail.user'),
        pass: config.get('mail.pass')
      }
    })

    this.send = (to, template, data = {}) => {
      if (!to || !template)
        return console.error(`📧 Mail to or template name not provided`)

      request(
        this.baseUrl,
        { qs: { vr: 'email', template, ...data } },
        (err, res) => {
          if (err || !res.body)
            return console.error(`📧 Mail template not found ${template}`)
          const subject = res.body
            .match(/SUBJECT_.*_SUBJECT/)[0]
            .replace('SUBJECT_', '')
            .replace('_SUBJECT', '')

          this.transport.sendMail({
            from: this.from,
            to,
            subject,
            html: res.body
          })
        }
      )
    }
    console.info(`📧Mail  READY`)
  }
}
