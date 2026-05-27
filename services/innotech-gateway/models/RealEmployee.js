const mongoose = require('mongoose');
const { RealEmployeeSchema } = require('@evation/db-schemas');

module.exports = mongoose.model('RealEmployee', RealEmployeeSchema);
