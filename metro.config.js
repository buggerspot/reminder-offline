const { getDefaultConfig } = require('expo/metro-config');
// Screens use native style objects. Avoid an unused CSS watcher in the native bundle.
module.exports = getDefaultConfig(__dirname);
