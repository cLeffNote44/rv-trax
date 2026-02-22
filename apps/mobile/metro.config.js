const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const defaultConfig = getDefaultConfig(projectRoot);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * We extend the default config to:
 * 1. Watch the monorepo root so workspace packages are resolved.
 * 2. Ensure `@rv-trax/shared` (and any future workspace deps) are bundled.
 */
const config = {
  watchFolders: [
    // Shared workspace package
    path.resolve(monorepoRoot, 'packages/shared'),
    // Root node_modules (for hoisted deps in pnpm workspaces)
    path.resolve(monorepoRoot, 'node_modules'),
  ],

  resolver: {
    // Make sure Metro can resolve modules from the monorepo root
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Disallow duplicate packages by preferring the project-level copy
    disableHierarchicalLookup: false,
  },
};

module.exports = mergeConfig(defaultConfig, config);
