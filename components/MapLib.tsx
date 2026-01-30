import { Platform } from "react-native";

// Platform-specific exports
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== "web") {
  try {
    const Maps = require("react-native-maps");
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn("react-native-maps not available");
  }
}

export { MapView, Marker, PROVIDER_GOOGLE };