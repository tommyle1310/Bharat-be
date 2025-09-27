const authService = require('../services/seller-auth.service');

exports.register = authService.register;
exports.login = authService.login;
exports.logout = authService.logout;
exports.verify = authService.verify;
