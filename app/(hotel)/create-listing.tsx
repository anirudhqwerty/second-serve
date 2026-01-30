import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { sendNotificationToNearbyUsers } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";

// Helper function for haptics that works on all platforms
const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
};

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function CreateFoodListing() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [quantity, setQuantity] = useState("");
  const [expiryHours, setExpiryHours] = useState("");
  const [foodType, setFoodType] = useState<"veg" | "non_veg" | "both">("veg");

  const [address, setAddress] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const [location, setLocation] = useState({
    latitude: 30.3398,
    longitude: 76.3869,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  const mapRef = useRef<any>(null);
  const searchTimeout = useRef<any>(null);

  // Get MapView components only on native
  const getMapsComponents = () => {
    if (Platform.OS === "web") return null;
    try {
      const Maps = require("react-native-maps");
      return {
        MapView: Maps.default,
        PROVIDER_GOOGLE: Maps.PROVIDER_GOOGLE,
      };
    } catch (e) {
      return null;
    }
  };

  const mapsComponents = getMapsComponents();

  // Web fallback UI
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Post Donation</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            Creating food donations is not available on web. Please use the mobile app.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backButtonFull}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const pickImages = async () => {
    if (images.length >= 3) {
      Alert.alert("Limit Reached", "You can only add up to 3 images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 3 - images.length,
      quality: 0.6,
    });

    if (!result.canceled) {
      const newUris = result.assets.map((asset) => asset.uri);
      setImages((prev) => [...prev, ...newUris].slice(0, 3));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  const uploadImages = async (userId: string) => {
    const uploadedUrls: string[] = [];

    for (const uri of images) {
      try {
        const fileExt = uri.split(".").pop()?.toLowerCase() ?? "jpg";
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });

        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(fileName, decode(base64), {
            contentType: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("listing-images")
          .getPublicUrl(fileName);

        uploadedUrls.push(data.publicUrl);
      } catch (error) {
        console.error("Error uploading image:", error);
        throw new Error(
          "Failed to upload images. Please check your internet connection.",
        );
      }
    }
    return uploadedUrls;
  };

  const searchPlaces = async (query: string) => {
    setAddress(query);
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            query,
          )}&key=${GOOGLE_MAPS_API_KEY}&components=country:in`,
        );
        const data = await response.json();
        if (data.predictions) setSearchResults(data.predictions);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const selectPlace = async (placeId: string, description: string) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const data = await response.json();
      if (data.result?.geometry?.location) {
        const { lat, lng } = data.result.geometry.location;
        const newLocation = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setLocation(newLocation);
        setAddress(description);
        setSearchResults([]);
        setShowMap(true);
        mapRef.current?.animateToRegion(newLocation, 1000);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      Alert.alert("Error", "Could not get location details");
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        setAddress(data.results[0].formatted_address);
      }
    } catch (error) {
      console.log("Reverse geocoding failed", error);
    }
  };

  const onRegionChangeComplete = (region: any) => {
    if (!showMap || !isMapReady) return;
    setLocation({
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    });
    reverseGeocode(region.latitude, region.longitude);
  };

  const handleSubmit = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    if (!title || !description || !quantity || !expiryHours || !address) {
      Alert.alert("Missing info", "Please fill all required fields");
      return;
    }

    if (images.length === 0) {
      Alert.alert(
        "Image Required",
        "Please add at least one photo of the food.",
      );
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const uploadedImageUrls = await uploadImages(user.id);

      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + parseInt(expiryHours));

      const { data: newListing, error } = await supabase
        .from("food_listings")
        .insert({
          hotel_id: user.id,
          title,
          description,
          quantity_kg: parseFloat(quantity),
          food_type: foodType,
          expiry_time: expiryDate.toISOString(),
          address,
          latitude: location.latitude,
          longitude: location.longitude,
          status: "available",
          images: uploadedImageUrls,
        })
        .select()
        .single();

      if (error) throw error;

      console.log("Food Listing created:", newListing.id);

      try {
        console.log("Sending notifications to nearby NGOs...");
        const notificationResult = await sendNotificationToNearbyUsers(
          newListing.id,
          {
            title: `Free Food: ${title}`,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
          },
        );
        console.log("Notification result:", notificationResult);
      } catch (notifError) {
        console.warn("Failed to send notifications:", notifError);
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Success!",
        "Your food donation has been posted and NGOs nearby have been notified.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message ?? "Failed to create listing");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Post Donation</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.scrollView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Title *</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="e.g., Fresh Biryani, Mixed Vegetables"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description *</Text>
            <View style={[styles.inputWrapper, styles.textArea]}>
              <TextInput
                placeholder="Describe the food items and condition..."
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.textAreaInput]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          {/* Quantity & Expiry */}
          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Quantity (kg) *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  placeholder="e.g., 5"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Expires in (hrs) *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  placeholder="e.g., 4"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  keyboardType="numeric"
                  value={expiryHours}
                  onChangeText={setExpiryHours}
                />
              </View>
            </View>
          </View>

          {/* Food Type */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Food Type *</Text>
            <View style={styles.typeContainer}>
              {(["veg", "non_veg", "both"] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeButton,
                    foodType === type && styles.typeButtonActive,
                  ]}
                  onPress={() => {
                    setFoodType(type);
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text
                    style={[
                      styles.typeText,
                      foodType === type && styles.typeTextActive,
                    ]}
                  >
                    {type === "veg"
                      ? "🌱 Veg"
                      : type === "non_veg"
                        ? "🍗 Non-Veg"
                        : "🍽️ Both"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Images */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Food Photos * (Max 3)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imagesScroll}
            >
              {images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.thumbnail} />
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
              {images.length < 3 && (
                <Pressable style={styles.addImageBtn} onPress={pickImages}>
                  <Ionicons name="camera" size={28} color="#007AFF" />
                  <Text style={styles.addImageText}>Add Photo</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>

          {/* Address / Location */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Pickup Location *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="location-sharp"
                size={20}
                color="#6B7280"
                style={{ marginRight: 10 }}
              />
              <TextInput
                placeholder="Search hotel/restaurant location..."
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={address}
                onChangeText={searchPlaces}
              />
              {searching && <ActivityIndicator size="small" color="#007AFF" />}
            </View>
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map((result) => (
                  <Pressable
                    key={result.place_id}
                    style={styles.searchResultItem}
                    onPress={() =>
                      selectPlace(result.place_id, result.description)
                    }
                  >
                    <Ionicons
                      name="location-sharp"
                      size={16}
                      color="#6B7280"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.searchResultText}>
                      {result.description}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Map Preview */}
          {showMap && mapsComponents && (
            <View style={styles.mapContainer}>
              <Text style={styles.label}>Confirm Location</Text>
              <View style={styles.mapWrapper}>
                <mapsComponents.MapView
                  ref={mapRef}
                  provider={mapsComponents.PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={location}
                  onMapReady={() => setIsMapReady(true)}
                  onRegionChangeComplete={onRegionChangeComplete}
                />
                <View style={styles.markerFixed}>
                  <Ionicons name="location-sharp" size={40} color="#EA4335" />
                </View>
              </View>
              <Text style={styles.mapHint}>
                {" "}
                Move map to pin exact pickup spot
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient
              colors={["#059669", "#047857"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {loading ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.submitText}>
                    {uploading ? "Uploading..." : "Posting..."}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitText}>Post Donation</Text>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  messageText: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 24,
  },
  backButtonFull: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  inputContainer: { marginBottom: 24 },
  rowContainer: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#374151" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    minHeight: 56,
  },
  textArea: { minHeight: 120, alignItems: "flex-start", paddingVertical: 16 },
  input: { flex: 1, fontSize: 16, color: "#111827" },
  textAreaInput: { minHeight: 100, textAlignVertical: "top" },

  imagesScroll: { flexDirection: "row", marginBottom: 8 },
  imageWrapper: { marginRight: 12, position: "relative" },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  removeBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FFF",
    borderRadius: 12,
  },
  addImageBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  addImageText: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "600",
    marginTop: 4,
  },

  typeContainer: { flexDirection: "row", gap: 10 },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFF",
  },
  typeButtonActive: { backgroundColor: "#EFF6FF", borderColor: "#007AFF" },
  typeText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  typeTextActive: { color: "#007AFF" },

  searchResults: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  searchResultText: { flex: 1, fontSize: 14, color: "#374151" },

  mapContainer: { marginBottom: 24 },
  mapWrapper: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  map: { flex: 1 },
  markerFixed: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -40,
    pointerEvents: "none",
    alignItems: "center",
    justifyContent: "center",
  },
  mapHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },

  submitButton: {
    height: 56,
    borderRadius: 12,
    marginTop: 16,
    overflow: "hidden",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: { flex: 1, justifyContent: "center", alignItems: "center" },
  submitButtonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  submitText: { color: "#FFFFFF", fontWeight: "700", fontSize: 17 },
});