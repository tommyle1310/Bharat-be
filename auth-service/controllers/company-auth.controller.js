const authService = require('../services/company-auth.service');

exports.login = authService.login;
exports.refreshToken = authService.refreshToken;
exports.logout = authService.logout;
exports.verify = authService.verify;
