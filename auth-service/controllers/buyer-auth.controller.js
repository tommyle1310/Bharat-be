const authService = require('../services/buyer-auth.service');

exports.register = authService.register;
exports.login = authService.login;
exports.logout = authService.logout;
exports.verify = authService.verify;
exports.refreshToken = authService.refreshToken;
exports.forgotPassword = authService.forgotPassword;