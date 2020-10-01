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

      request(
        this.baseUrl,
        { qs: { vr: 'email', template, ...data } },
        (err, res) => {
          if (err || !res.body)
            return console.error(`📧 Mail template not found ${template}`)

          let subjectTag = res.body.match(/SUBJECT_.*_SUBJECT/)
          subjectTag =
            (subjectTag && subjectTag[0]) ||
            `SUBJECT_${config.get('mail')}_SUBJECT`

          const subject = subjectTag
            .replace('SUBJECT_', '')
            .replace('_SUBJECT', '')

          this.transport
            .sendMail({
              from: this.from,
              to,
              subject,
              html: res.body.replace(subjectTag, '')
            })
            .catch((err) =>
              require('.').monitor.log(
                'Email failed',
                'sendEmail',
                { template, to, err: err.message },
                'error'
              )
            )
        }
      )
    }
    console.info(`📧Mail  READY`)
  }
}
