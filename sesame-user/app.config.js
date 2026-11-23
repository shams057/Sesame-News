const fs = require('fs');
const path = require('path');

// Dynamic Expo config: identity, permissions and per-environment settings.
// APP_ENV is set by the EAS build profile (see eas.json); local runs are "development".
const APP_ENV = process.env.APP_ENV || 'development';
const isProduction = APP_ENV === 'production';
const APP_ID = 'sesame.news';
// Plain HTTP is allowed only when the API itself is served over http://
// (local / campus server). With an https:// API it stays forbidden.
const ALLOW_HTTP = !isProduction || (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').startsWith('http://');

/**
 * Firebase config for Android push, used only when it was generated for this
 * app id (otherwise the Google Services Gradle plugin aborts the build).
 */
function googleServicesFile() {
  const file = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(file)) return {};
  try {
    const { client = [] } = JSON.parse(fs.readFileSync(file, 'utf8'));
    const matches = client.some((entry) => entry.client_info?.android_client_info?.package_name === APP_ID);
    if (!matches) {
      console.warn(`[app.config] google-services.json does not contain "${APP_ID}": Android push disabled until it is regenerated.`);
      return {};
    }
    return { googleServicesFile: './google-services.json' };
  } catch {
    return {};
  }
}

module.exports = {
  expo: {
    name: isProduction ? 'Sesame News' : `Sesame News (${APP_ENV})`,
    slug: 'sesame-etudiant',
    scheme: 'sesame',
    version: '2.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: { image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#ffffff' },
    ios: {
      supportsTablet: true,
      bundleIdentifier: APP_ID,
    },
    android: {
      package: APP_ID,
      adaptiveIcon: {
        backgroundColor: '#FFFFFF',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: ['POST_NOTIFICATIONS'],
      blockedPermissions: ['android.permission.RECORD_AUDIO'],
      // Firebase config for Android push (download from the Firebase console).
      ...googleServicesFile(),
    },
    web: { favicon: './assets/favicon.png', name: 'Sesame News', themeColor: '#023e9a' },
    plugins: [
      ['expo-build-properties', { android: { usesCleartextTraffic: ALLOW_HTTP } }],
      'expo-video',
      'expo-sharing',
      'expo-web-browser',
      'expo-secure-store',
      ['expo-notifications', { icon: './assets/android-icon-monochrome.png', color: '#023e9a' }],
    ],
    owner: 'shams057',
    extra: {
      appEnv: APP_ENV,
      // EAS project (created with `eas init`), required for Expo push tokens.
      eas: { projectId: process.env.EAS_PROJECT_ID || '6e05092b-8e3b-433c-bf40-d2306a38ccc2' },
    },
  },
};
