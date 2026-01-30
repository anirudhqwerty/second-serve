import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    FlatList,
    Image,
    Platform,
    Pressable,
    RefreshControl,
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

const triggerNotificationHaptic = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(type);
  }
};

const ScalePressable = ({ children, style, onPress }: any) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[style, { transform: [{ scale: scaleValue }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const SkeletonCard = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return <Animated.View style={[styles.skeletonCard, { opacity }]} />;
};

export default function HotelListings() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchListings();
    }, []),
  );

  const fetchListings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // UPDATED: Fetch from 'food_listings'
      const { data, error } = await supabase
        .from("food_listings")
        .select("*")
        .eq("hotel_id", user.id) // Changed owner_id -> hotel_id
        .order("created_at", { ascending: false });

      if (data) setListings(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
  };

  const openListingDetail = (listing: any) => {
    Haptics.selectionAsync();
    setSelectedListing(listing);
    setModalVisible(true);
  };

  const handleCreateListing = () => {
    Haptics.selectionAsync();
    // UPDATED: Path
    router.push("/(hotel)/create-listing");
  };

  const handleEditListing = () => {
    Alert.alert("Edit Listing", "Edit functionality coming soon!");
  };

  const handleDeleteListing = async () => {
    if (!selectedListing) return;

    try {
      // UPDATED: Table name
      const { error } = await supabase
        .from("food_listings")
        .delete()
        .eq("id", selectedListing.id);

      if (error) throw error;

      triggerNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      fetchListings();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to delete listing");
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    // Status Color Logic
    const isAvailable = item.status === "available";
    const isCollected = item.status === "collected";
    const statusColor = isCollected
      ? "#10B981"
      : isAvailable
        ? "#059669"
        : "#F59E0B";
    const statusBg = isCollected
      ? "#ECFDF5"
      : isAvailable
        ? "#ECFDF5"
        : "#FFFBEB";

    return (
      <ScalePressable
        style={styles.card}
        onPress={() => openListingDetail(item)}
      >
        <View style={styles.cardContentRow}>
          <Image
            source={{
              uri:
                item.images?.[0] ||
                "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
            }}
            style={styles.thumbnail}
            resizeMode="cover"
          />

          <View style={styles.cardDetails}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {/* Status Badge */}
              <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.row}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.address} numberOfLines={1}>
                {item.address}
              </Text>
            </View>

            <View style={styles.priceContainer}>
              <Text style={styles.price}>{item.quantity_kg}</Text>
              <Text style={styles.perMonth}>kg</Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.dateText}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
              {/* Show Expiry if available */}
              <View style={styles.interestedTag}>
                <Ionicons name="time-outline" size={12} color="#D97706" />
                <Text style={styles.interestedText}>
                  Expires{" "}
                  {new Date(item.expiry_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScalePressable>
    );
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>My Donations</Text>
            <Text style={styles.headerSubtitle}>
              {listings.length} {listings.length === 1 ? "item" : "items"}{" "}
              posted
            </Text>
          </View>

          <Pressable
            onPress={handleCreateListing}
            hitSlop={10}
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color="#007AFF" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.list}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <FlatList
            data={listings}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconBg}>
                  <Ionicons
                    name="fast-food-outline"
                    size={32}
                    color="#9CA3AF"
                  />
                </View>
                <Text style={styles.emptyTitle}>No donations found</Text>
                <Text style={styles.emptySubtitle}>
                  You haven't listed any food yet. Post a donation to help those
                  in need.
                </Text>

                <Pressable
                  style={styles.ctaButton}
                  onPress={handleCreateListing}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.ctaText}>Donate Food</Text>
                </Pressable>
              </View>
            }
          />
        )}
      </View>

      <ListingDetailModal
        visible={modalVisible}
        listing={selectedListing}
        onClose={() => setModalVisible(false)}
        isOwner={true}
        onEdit={handleEditListing}
        onDelete={handleDeleteListing}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    width: 40,
    alignItems: "flex-start",
  },
  addButton: {
    width: 40,
    alignItems: "flex-end",
  },
  headerTextContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },

  // List
  list: {
    padding: 20,
    paddingBottom: 40,
  },

  // Card Styles
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16, // Clean rounded corners
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContentRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  cardDetails: {
    flex: 1,
    height: 100,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  // Address
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -4, // Tighten up spacing
  },
  address: {
    color: "#6B7280",
    fontSize: 13,
    flex: 1,
  },

  // Price
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827", // Clean black price
  },
  perMonth: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 2,
  },

  // Footer Stats
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  interestedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    // backgroundColor: '#FEF2F2',
    // paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  interestedText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#D97706",
  },

  // Empty State
  empty: {
    alignItems: "center",
    marginTop: 60,
    padding: 20,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: "80%",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111827",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },

  // Skeleton
  skeletonCard: {
    height: 124, // Matching card height
    width: "100%",
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    marginBottom: 16,
  },
});
