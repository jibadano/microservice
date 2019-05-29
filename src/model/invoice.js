const { Schema } = require('mongoose')

const Invoice = new Schema({
  name: String,
  user: { type: String, ref: 'User' },
  address: String,
  idNumber: String,
  products: [{ quantity: Number, desc: String, price: Number }],
  date: { type: Date, default: Date.now },
  customer: { type: String, ref: 'User' },
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

module.exports = Invoice