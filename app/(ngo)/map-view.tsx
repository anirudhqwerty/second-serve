import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ListingDetailModal from "../../components/ListingDetailModal";
import { supabase } from "../../lib/supabase";

// Helper function for haptics that works on all platforms
const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
};

export default function NgoMapView() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Web fallback
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Nearby Food</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            Map view is not available on web. Please use the mobile app to view
            nearby food listings.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButtonFull}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Get maps components only for native platforms
  const getMapsComponents = () => {
    if (Platform.OS === "web") return null;
    try {
      const Maps = require("react-native-maps");
      return {
        MapView: Maps.default,
        Marker: Maps.Marker,
        PROVIDER_GOOGLE: Maps.PROVIDER_GOOGLE,
      };
    } catch (error) {
      console.warn("react-native-maps not available:", error);
      return null;
    }
  };

  const mapsComponents = getMapsComponents();

  // Default to a central location (e.g. city center)
  const [region, setRegion] = useState<any>({
    latitude: 30.3398,
    longitude: 76.3869,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  const mapRef = useRef<any>(null);

  useEffect(() => {
    loadListingsAndLocation();
  }, []);

  const loadListingsAndLocation = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("latitude, longitude")
        .eq("id", user.id)
        .single();

      if (profile?.latitude && profile?.longitude) {
        const newRegion = {
          latitude: profile.latitude,
          longitude: profile.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
      }

      const { data: listingsData } = await supabase
        .from("food_listings")
        .select(
          `
          *,
          hotel:profiles!food_listings_hotel_id_fkey(name, phone)
        `,
        )
        .eq("status", "available")
        .gt("expiry_time", new Date().toISOString())
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (listingsData) {
        const formattedListings = listingsData.map((listing: any) => ({
          ...listing,
          owner_name: listing.hotel?.name,
          owner_phone: listing.hotel?.phone,
        }));
        setListings(formattedListings);
      }
    } catch (error) {
      console.error("Error loading map data:", error);
      Alert.alert("Error", "Failed to load food listings");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerPress = (listing: any) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedListing(listing);
    setModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!mapsComponents) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Nearby Food</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            Maps library not available. Please check your installation.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButtonFull}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { MapView, Marker, PROVIDER_GOOGLE } = mapsComponents;

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Nearby Food</Text>
          <View style={{ width: 40 }} />
        </View>

        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {listings.map((listing) => (
            <Marker
              key={listing.id}
              coordinate={{
                latitude: parseFloat(listing.latitude),
                longitude: parseFloat(listing.longitude),
              }}
              onPress={() => handleMarkerPress(listing)}
            >
              <View style={styles.markerContainer}>
                <View
                  style={[
                    styles.marker,
                    {
                      backgroundColor:
                        listing.food_type === "non_veg" ? "#EF4444" : "#10B981",
                    },
                  ]}
                >
                  <Ionicons name="fast-food" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.markerBadge}>
                  <Text style={styles.markerBadgeText}>
                    {listing.quantity_kg}kg
                  </Text>
                </View>
                <View
                  style={[
                    styles.markerArrow,
                    {
                      borderTopColor:
                        listing.food_type === "non_veg" ? "#EF4444" : "#10B981",
                    },
                  ]}
                />
              </View>
            </Marker>
          ))}
        </MapView>

        <View style={styles.statsCard}>
          <Ionicons name="location" size={20} color="#007AFF" />
          <Text style={styles.statsText}>
            {listings.length} donations nearby
          </Text>
        </View>
      </View>

      <ListingDetailModal
        visible={modalVisible}
        listing={selectedListing}
        onClose={() => setModalVisible(false)}
        isOwner={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
    width: 60,
    height: 60,
    justifyContent: "center",
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  markerBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  markerBadgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "700",
  },
  statsCard: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statsText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
});