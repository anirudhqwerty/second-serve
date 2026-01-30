import 'dotenv/config';

export default {
  expo: {
    name: "Second Serve",
    slug: "second-serve",
    scheme: "second-serve",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    icon: "./assets/images/icon.png",
    
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anirudh.second-serve"
    },
    
    android: {
      package: "com.anirudh.second-serve",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
        backgroundColor: "#E6F4FE"
      }
    },
    
    web: {
      output: "static", // Creates an index.html for every route (great for SEO/speed)
      bundler: "metro", // REQUIRED for React Native Web Maps compatibility
      favicon: "./assets/images/favicon.png"
    },
    
    plugins: [
      "expo-router",
      "expo-notifications",
      "expo-web-browser",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ]
    ],
    
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      eas: {
        projectId: "a45d3b8c-ce51-474f-8074-c02be2936e7f"
      }
    }
  }
};