const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '..');
const corePackageRoot = path.resolve(workspaceRoot, 'packages/core');

/**
 * Metro configuration for ASTERIAL React Native Android app.
 * Resolves @asterial/core and centralized version.json while isolating mobile
 * React / React Native instances from the root Next.js node_modules.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  watchFolders: [corePackageRoot, workspaceRoot],
  resolver: {
    blockList: [
      new RegExp(`${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\.next/.*`),
      new RegExp(`${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/node_modules/react/.*`),
      new RegExp(`${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/node_modules/react-dom/.*`),
    ],
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    extraNodeModules: {
      '@asterial/core': corePackageRoot,
      zod: path.resolve(__dirname, 'node_modules/zod'),
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
