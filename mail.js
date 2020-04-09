const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
module.exports = class mail {
  constructor(config) {
    console.info(`📧 mail init`)

    if (config.get('mail')) {
      const mailPath = config.get('mail.path') || 'src/mail'
      this.from = config.get('mail.from') || config.get('name')
      this.transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.get('mail.user'),
          pass: config.get('mail.pass')
        }
      })

      this.send = (to, templateName, data = {}) => {
        if (!to || !templateName)
          return console.error(`📧 mail to or template name not provided`)

        let template = this.templates[templateName]
        if (!template)
          return console.error(`📧 mail template not found ${template}`)

        let subject =
          templateName[0].toUpperCase() +
          templateName.slice(1).replace('_', ' ')

        for (let d in data) {
          subject = subject.replace(new RegExp(`{{${d}}}`, 'g'), data[d])
          template = template.replace(new RegExp(`{{${d}}}`, 'g'), data[d])
        }

        this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          html: template
        })
      }

      const mailDir = process.env.PWD + '/' + mailPath
      console.info(`📧 mail reading from ${mailDir}`)

      this.templates = {}
      try {
        fs.readdirSync(mailDir).forEach((mailFile) => {
          if (mailFile !== 'index.js' && mailFile.endsWith('.html')) {
            const template = fs.readFileSync(
              path.resolve(`${mailDir}/${mailFile}`)
            )
            const templateName = serviceFile.replace('.html', '')
            this.templates[templateName] = template

            console.info(`📧 mail loaded ${mailFile}`)
          }
        })
      } catch (e) {
        console.info(`📧 mail not loaded ${e}`)
      }
    } else {
      console.info(`📧 mail no config found`)
    }
    console.info(`📧 mail init done`)
  }
}
