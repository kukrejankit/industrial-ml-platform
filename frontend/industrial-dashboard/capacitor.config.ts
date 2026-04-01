import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.industrialml.app',
  appName: 'Industrial ML',
  webDir: 'dist/industrial-dashboard/browser',
  server: {
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
