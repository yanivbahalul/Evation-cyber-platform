const mongoose = require('mongoose');
const { AdminUserSchema } = require('@evation/db-schemas');

module.exports = mongoose.model('AdminUser', AdminUserSchema);
