const { Schema } = require('mongoose')

const User = new Schema({
  _id: {
    type: String,
    match: /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
    required: true,
    lowercase: true,
    trim: true,
    maxLength: 128,
    alias: 'email'
  },
  birthdate: Date,
  firstName: { type: String },
  lastName: { type: String },
  avatar: { type: String },
  created: { type: Date, default: Date.now },
  password: { type: String, required: true },
  admin: Boolean
})

module.exports = User
