import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.labos.app',
  appName: 'LabOS',
  webDir: 'dist',
  server: {
    // Dev: set CAPACITOR_DEV_URL=http://<your-machine-ip>:5173 before running
    // cap sync, then the app will hot-reload against your local Vite server.
    // Production: leave url commented out so the app serves the dist/ bundle.
    url: process.env.CAPACITOR_DEV_URL,
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0d1b2a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0d1b2a',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6366f1',
    },
  },
  android: {
    buildOptions: {
      keystorePath: 'release-keystore.jks',
      keystoreAlias: 'labos',
    },
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
