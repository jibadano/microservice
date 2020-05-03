const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

const DEFAULT_PATH = 'src/mail'
module.exports = class Mail {
  constructor(config) {
    if (config.get('mail')) {
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
          return console.error(`📧 Mail to or template name not provided`)

        let template = this.templates[templateName]
        if (!template)
          return console.error(`📧 Mail template not found ${template}`)

        let subject =
          templateName[0].toUpperCase() +
          templateName.slice(1).replace(/_/g, ' ')

        for (let d in data) {
          subject = subject.replace(new RegExp(`{{${d}}}`, 'g'), data[d])
          template = template.replace(new RegExp(`{{${d}}}`, 'g'), data[d])
        }

        this.transport.sendMail({
          from: { name: this.from, address: config.get('mail.user') },
          to,
          subject,
          html: template
        })
      }

      const mailPath = config.get('mail.path') || DEFAULT_PATH
      const mailDir = process.env.PWD + '/' + mailPath
      this.templates = {}
      try {
        fs.readdirSync(mailDir).forEach((mailFile) => {
          if (mailFile !== 'index.js' && mailFile.endsWith('.html')) {
            const template = fs.readFileSync(
              path.resolve(`${mailDir}/${mailFile}`)
            )
            const templateName = mailFile.replace('.html', '')
            this.templates[templateName] = template.toString()
          }
        })
      } catch (e) {}
    }

    const templateNames = Object.keys(this.templates)
    templateNames.length &&
      console.info(`📧Mail  READY ${templateNames.map((t) => `\n\t${t}`)}`)
  }
}
