module.exports = {
  AttackEventSchema: require('./malicious/AttackEvent'),
  AttackerProfileSchema: require('./malicious/AttackerProfile'),
  HoneyTokenSchema: require('./malicious/HoneyToken'),
  AdminUserSchema: require('./admin/AdminUser'),
  SafezoneUserSchema: require('./safezone/SafezoneUser'),
  RealEmployeeSchema: require('./safezone/RealEmployee'),
  get createMaliciousConnection() {
    return require('./connect').createMaliciousConnection;
  },
};
