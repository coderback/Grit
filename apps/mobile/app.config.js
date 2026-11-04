// Adds build-specific settings on top of app.json.
//
// Plain-HTTP traffic is only allowed in development builds, which may talk to
// a backend on the local network. Store builds (EAS "preview" and
// "production") only use HTTPS.
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const development = profile ? profile === 'development' : process.env.NODE_ENV !== 'production';
  return {
    ...config,
    android: { ...config.android, usesCleartextTraffic: development },
  };
};
