const { getDefaultConfig } = require('expo/metro-config');

/** Expo's defaults, plus .woff2 so the web build can ship compressed, subset fonts. */
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('woff2');

module.exports = config;
