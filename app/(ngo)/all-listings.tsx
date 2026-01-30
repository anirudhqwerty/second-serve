import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
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

export default function AllDonationsScreen() {
  const [listings, setListings] = useState<any[]>([]);
  const [filteredListings, setFilteredListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadAllListings();
  }, []);

  useEffect(() => {
    filterListings();
  }, [searchQuery, listings]);

  const loadAllListings = async () => {
    try {
      // UPDATED: Fetch from 'food_listings'
      const { data: listingsData } = await supabase
        .from("food_listings")
        .select(
          `
          *,
          hotel:profiles!food_listings_hotel_id_fkey(name, phone)
        `,
        )
        .eq("status", "available")
        .gt("expiry_time", new Date().toISOString()) // Only non-expired
        .order("created_at", { ascending: false });

      if (listingsData) {
        const formattedListings = listingsData.map((listing: any) => ({
          ...listing,
          owner_name: listing.hotel?.name,
          owner_phone: listing.hotel?.phone,
        }));
        setListings(formattedListings);
        setFilteredListings(formattedListings);
      }
    } catch (error) {
      console.error("Error loading listings:", error);
      Alert.alert("Error", "Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  const filterListings = () => {
    if (!searchQuery.trim()) {
      setFilteredListings(listings);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = listings.filter(
      (listing) =>
        listing.title.toLowerCase().includes(query) ||
        listing.address.toLowerCase().includes(query) ||
        listing.description.toLowerCase().includes(query),
    );
    setFilteredListings(filtered);
  };

  const openListingDetail = (listing: any) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedListing(listing);
    setModalVisible(true);
  };

  // Helper for expiry display
  const getExpiryDisplay = (dateString: string) => {
    const diff = new Date(dateString).getTime() - new Date().getTime();
    const hours = Math.ceil(diff / (1000 * 3600));
    if (hours < 0) return "Expired";
    if (hours < 24) return `Expires in ${hours}h`;
    return `Expires ${new Date(dateString).toLocaleDateString()}`;
  };

  const renderListingCard = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [
        styles.listingCard,
        pressed && styles.listingCardPressed,
      ]}
      onPress={() => openListingDetail(item)}
    >
      <View style={styles.listingHeader}>
        <Text style={styles.listingTitle}>{item.title}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>FRESH</Text>
        </View>
      </View>

      <View style={styles.listingRow}>
        <Ionicons name="business-outline" size={16} color="#6B7280" />
        <Text style={styles.listingAddress} numberOfLines={1}>
          {item.owner_name || "Hotel Partner"}
        </Text>
      </View>

      <View style={styles.listingRow}>
        <Ionicons name="location-outline" size={16} color="#6B7280" />
        <Text style={styles.listingAddress} numberOfLines={1}>
          {item.address}
        </Text>
      </View>

      {/* Quantity & Expiry Row */}
      <View style={styles.metaRow}>
        <Text style={styles.listingPrice}>{item.quantity_kg} kg available</Text>
        <Text style={styles.expiryText}>
          {getExpiryDisplay(item.expiry_time)}
        </Text>
      </View>

      <View style={styles.tapHint}>
        <Text style={styles.tapHintText}>Tap to Claim</Text>
        <Ionicons name="chevron-forward" size={16} color="#059669" />
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </Pressable>
          <Text style={styles.headerTitle}>All Donations</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food, location..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {filteredListings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="fast-food-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No food found" : "No donations available"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "Try a different search term"
                : "Check back later for new food listings"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredListings}
            renderItem={renderListingCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
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
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  list: {
    padding: 16,
  },
  listingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  listingCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  listingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#166534",
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  listingAddress: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#059669", // Green for quantity
  },
  expiryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D97706", // Orange for expiry
  },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  tapHintText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
