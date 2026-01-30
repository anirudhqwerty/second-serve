import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useFocusEffect, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import ListingDetailModal from "../../components/ListingDetailModal";

const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60),
  );

  if (diffInHours < 1) return "Claimed just now";
  if (diffInHours < 24) return `Claimed ${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `Claimed ${diffInDays} days ago`;
};

// --- Micro-Component: Scale Animation ---
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

export default function NgoClaimsScreen() {
  const [claimedListings, setClaimedListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadClaims();
    }, []),
  );

  const loadClaims = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // UPDATED: Fetch from 'food_claims' table
      const { data: claims } = await supabase
        .from("food_claims")
        .select(
          `
          food_listing_id,
          claimed_at,
          status,
          listing:food_listings (
            *,
            hotel:profiles!food_listings_hotel_id_fkey(name, phone)
          )
        `,
        )
        .eq("ngo_id", user.id)
        .order("claimed_at", { ascending: false });

      if (claims) {
        const formattedListings = claims
          .filter((item) => item.listing)
          .map((item: any) => ({
            ...item.listing,
            owner_name: item.listing.hotel?.name,
            owner_phone: item.listing.hotel?.phone,
            claimed_at: item.claimed_at,
            claim_status: item.status, // 'pending', 'confirmed', etc.
          }));
        setClaimedListings(formattedListings);
      }
    } catch (error) {
      console.error("Error loading claims:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadClaims();
  };

  const openListingDetail = (listing: any) => {
    Haptics.selectionAsync();
    setSelectedListing(listing);
    setModalVisible(true);
  };

  const navigateToExplore = () => {
    Haptics.selectionAsync();
    // UPDATED: Path /ngo/all-listings
    router.push("/all-listings");
  };

  const renderListingCard = ({ item }: { item: any }) => (
    <ScalePressable
      style={styles.listingCard}
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
            <Text style={styles.listingTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {/* Status Badge */}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.claim_status === "collected" ? "#10B981" : "#F59E0B",
                },
              ]}
            >
              <Text style={styles.statusText}>
                {item.claim_status === "collected" ? "COLLECTED" : "PENDING"}
              </Text>
            </View>
          </View>

          <View style={styles.listingRow}>
            <Ionicons name="business-outline" size={14} color="#6B7280" />
            <Text style={styles.listingAddress} numberOfLines={1}>
              {item.owner_name || "Hotel"}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.listingPrice}>{item.quantity_kg}</Text>
            <Text style={styles.perMonth}>kg</Text>
          </View>

          <Text style={styles.savedDateText}>
            {getRelativeTime(item.claimed_at)}
          </Text>
        </View>
      </View>
    </ScalePressable>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#111827"
          />
        }
      >
        {/* Clean Text-Only Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Claims</Text>
          <Text style={styles.subtitle}>Food you have reserved</Text>
        </View>

        {claimedListings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="fast-food-outline" size={32} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No active claims</Text>
            <Text style={styles.emptySubtitle}>
              You haven't claimed any food donations yet. Check the map to find
              food nearby.
            </Text>

            <ScalePressable
              style={styles.ctaButton}
              onPress={navigateToExplore}
            >
              <Text style={styles.ctaText}>Find Food</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </ScalePressable>
          </View>
        ) : (
          <View style={styles.listingsContainer}>
            {claimedListings.map((item) => (
              <View key={item.id}>{renderListingCard({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>

      <ListingDetailModal
        visible={modalVisible}
        listing={selectedListing}
        onClose={() => {
          setModalVisible(false);
          loadClaims();
        }}
        isOwner={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  content: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },

  // Clean Header
  header: {
    backgroundColor: "#FFFFFF",
    paddingTop: 70,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Listings List
  listingsContainer: {
    padding: 20,
    gap: 16,
  },

  // Listing Card
  listingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  cardDetails: {
    flex: 1,
    justifyContent: "center",
    height: 100,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  listingTitle: {
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
    color: "#FFF",
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  listingAddress: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: "auto", // Pushes price to bottom of container
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  perMonth: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 2,
  },
  savedDateText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 40,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
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
    lineHeight: 22,
    marginBottom: 32,
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
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
