const { Schema } = require('mongoose')

const Event = new Schema({
  name: String,
  host: { type: String, ref: 'User' },
  guests: [{ type: String, ref: 'User' }],
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'DRAFT'},
  desc: String
})

/* // a setter
Comment.path('name').set(function (v) {
  return capitalize(v);
});

// middleware
Comment.pre('save', function (next) {
  notify(this.get('email'));
  next();
}); */

module.exports = Event