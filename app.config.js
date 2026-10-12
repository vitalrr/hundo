const { assertPublicClientConfig } = require('./scripts/client-config-guard.cjs');

module.exports = ({ config }) => {
  require('@expo/env').load(__dirname, { silent: true });
  assertPublicClientConfig(process.env);
  return config;
};
