import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.labos.app',
  appName: 'LabOS',
  webDir: 'dist',
  server: {
    // During development point to your local Vite server.
    // For production builds remove the `url` key entirely — the app
    // will serve the bundled `dist/` folder offline.
    // url: 'http://192.168.1.XXX:5173',
    androidScheme: 'https',
    cleartext: true,          // allow http:// to reach local API server
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
