/**
 * Environment variables injected via react-native-dotenv or react-native-config.
 */
declare module '@env' {
  export const API_URL: string;
  export const WS_URL: string;
  export const GOOGLE_MAPS_API_KEY: string;
}

/**
 * Allow importing JSON files (app.json, etc.)
 */
declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}

/**
 * Allow importing image assets.
 */
declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.svg' {
  import type React from 'react';
  import type { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}
