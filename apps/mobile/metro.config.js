const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Web demo only: swap modules that do not work well in a browser. Native builds are unaffected.
if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
  const demoModules = {
    '@gorhom/bottom-sheet': 'components/demo/WebBottomSheet.tsx',
    'expo-camera': 'components/demo/expoCameraStub.ts',
  };
  const resolveBase = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (demoModules[moduleName]) {
      return { type: 'sourceFile', filePath: path.join(__dirname, demoModules[moduleName]) };
    }
    return (resolveBase ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = withNativeWind(config, { input: './global.css' });
