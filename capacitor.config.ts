import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.organictech.smartveg',
  appName: 'OrganicTech',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0, 
      launchAutoHide: true,
    },
  }
};

export default config;