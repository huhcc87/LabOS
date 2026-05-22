import type { CapacitorConfig } from '@capacitor/cli';

// Dev hot-reload: CAPACITOR_DEV_URL=http://<your-machine-ip>:5173 npx cap sync
// Production: leave the env var unset — app serves from the dist/ bundle.
const devUrl = process.env.CAPACITOR_DEV_URL;

const config: CapacitorConfig = {
  appId: 'com.labos.app',
  appName: 'LabOS',
  webDir: 'dist',
  server: {
    ...(devUrl ? { url: devUrl } : {}),
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
