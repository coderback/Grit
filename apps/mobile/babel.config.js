module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // zustand/middleware uses import.meta, which Metro bundles don't support natively
      ['babel-preset-expo', { jsxImportSource: 'nativewind', unstable_transformImportMeta: true }],
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
