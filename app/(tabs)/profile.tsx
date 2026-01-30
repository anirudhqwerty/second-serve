import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { getFreshPushToken } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";

// Web responsiveness
const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";
const maxWidth = isWeb ? 800 : width;

// Helper function for haptics that works on all platforms
const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
};

const triggerNotificationHaptic = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(type);
  }
};

export default function NgoProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [radius, setRadius] = useState(15);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, []),
  );

  const loadSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // UPDATED: notification_settings table is merged into profiles in the new schema
      // But for compatibility with your provided schema, we might need to check column existence.
      // Assuming 'notification_radius_km' is on 'profiles' based on your SQL:
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      if (profileData) {
        // Map fields from profile directly (based on your schema)
        setNotificationsEnabled(!!profileData.push_token); // If token exists, enabled
        setRadius(profileData.notification_radius_km || 15);
        if (profileData.latitude && profileData.longitude) {
          setLocation({
            latitude: profileData.latitude,
            longitude: profileData.longitude,
          });
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMap = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    // UPDATED: Path /seeker/ -> /ngo/
    router.push("/(ngo)/update-location");
  };

  const saveSettings = async () => {
    if (!location && notificationsEnabled) {
      Alert.alert(
        "Location Required",
        "Please set your location to enable notifications",
      );
      return;
    }

    setSaving(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      let pushToken = null;
      if (notificationsEnabled) {
        pushToken = await getFreshPushToken();

        if (!pushToken) {
          console.warn("Could not generate push token");
        }
      }

      // UPDATED: Saving directly to 'profiles' based on your schema
      const { error } = await supabase
        .from("profiles")
        .update({
          notification_radius_km: radius,
          // Lat/Long are usually updated via the map screen, but saving here is fine too if changed manually
          // latitude: location?.latitude,
          // longitude: location?.longitude,
          push_token: pushToken,
        })
        .eq("id", user.id);

      if (error) throw error;

      triggerNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Profile settings saved!");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong");
      triggerNotificationHaptic(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Removed back button since this is a Tab */}
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isWeb && { maxWidth, alignSelf: "center", width: "100%" },
        ]}
        showsVerticalScrollIndicator={!isWeb}
      >
        <View style={styles.section}>
          <View style={styles.iconContainer}>
            <Ionicons name="person" size={40} color="#007AFF" />
          </View>
          <Text style={styles.sectionTitle}>{profile?.name}</Text>
          <Text style={styles.sectionSubtitle}>
            {profile?.role === "ngo" ? "NGO Partner" : "User"}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Enable Food Alerts</Text>
              <Text style={styles.settingDescription}>
                Get notified when hotels post leftover food near you
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: "#E5E7EB", true: "#93C5FD" }}
              thumbColor={notificationsEnabled ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </View>

        {notificationsEnabled && (
          <>
            <View style={styles.card}>
              <View style={styles.radiusSection}>
                <View style={styles.radiusHeader}>
                  <Text style={styles.settingTitle}>Pickup Radius</Text>
                  <View style={styles.radiusBadge}>
                    <Text style={styles.radiusValue}>{radius} km</Text>
                  </View>
                </View>
                <Text style={styles.settingDescription}>
                  You will see food listings within this distance
                </Text>

                <View style={styles.sliderContainer}>
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>5 km</Text>
                    <Text style={styles.sliderLabel}>50 km</Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={5}
                    maximumValue={50}
                    step={5}
                    value={radius}
                    onValueChange={(value) => {
                      setRadius(value);
                      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    minimumTrackTintColor="#007AFF"
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor="#007AFF"
                  />
                  <View style={styles.radiusIndicators}>
                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((km) => (
                      <View
                        key={km}
                        style={[
                          styles.radiusMarker,
                          radius === km && styles.radiusMarkerActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.settingTitle}>NGO Location</Text>
              <Text style={styles.settingDescription}>
                This location is used to calculate distance to hotels
              </Text>

              <View style={styles.locationPreview}>
                <View style={styles.locationIcon}>
                  <Ionicons name="location" size={24} color="#007AFF" />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabel}>Current Address</Text>
                  <Text style={styles.locationValue} numberOfLines={1}>
                    {profile?.address || "No location set"}
                  </Text>
                  {location && (
                    <Text style={styles.locationCoords}>
                      {location.latitude.toFixed(4)},{" "}
                      {location.longitude.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.updateLocationButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleOpenMap}
              >
                <Ionicons name="map-outline" size={20} color="#007AFF" />
                <Text style={styles.updateLocationText}>Update on Map</Text>
              </Pressable>
            </View>

            <View style={styles.infoCard}>
              <Ionicons
                name="information-circle"
                size={24}
                color="#92400E"
                style={{ marginRight: 12 }}
              />
              <Text style={styles.infoText}>
                You'll receive push notifications when hotels list food that
                matches your radius.
              </Text>
            </View>
          </>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={saveSettings}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Settings"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  section: { alignItems: "center", marginBottom: 32 },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
    textAlign: "center",
  },
  sectionSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingInfo: { flex: 1, marginRight: 16 },
  settingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  settingDescription: { fontSize: 14, color: "#6B7280", lineHeight: 20 },
  radiusSection: { gap: 8 },
  radiusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  radiusBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  radiusValue: { fontSize: 16, fontWeight: "700", color: "#007AFF" },
  sliderContainer: { marginTop: 16 },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sliderLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  slider: { width: "100%", height: 40 },
  radiusIndicators: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -8,
    paddingHorizontal: 2,
  },
  radiusMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  radiusMarkerActive: {
    backgroundColor: "#007AFF",
    transform: [{ scale: 1.3 }],
  },
  locationPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  locationTextContainer: { flex: 1 },
  locationLabel: { fontSize: 12, color: "#6B7280", marginBottom: 2 },
  locationValue: { fontSize: 15, fontWeight: "600", color: "#111827" },
  locationCoords: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  updateLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 16,
  },
  updateLocationText: { fontSize: 15, fontWeight: "700", color: "#007AFF" },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  infoCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  infoText: { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 20 },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
