const mongoose = require('mongoose');
const { HrTicketSchema } = require('@evation/db-schemas');

module.exports = mongoose.model('HrTicket', HrTicketSchema);
