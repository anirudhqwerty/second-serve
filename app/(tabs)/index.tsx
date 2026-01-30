import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ListingDetailModal from "../../components/ListingDetailModal";
import { supabase } from "../../lib/supabase";

const ScalePressable = ({
  children,
  style,
  onPress,
  activeScale = 0.97,
}: any) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const animateIn = () => {
    Animated.spring(scaleValue, {
      toValue: activeScale,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const animateOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={animateIn}
      onPressOut={animateOut}
      style={[style, { cursor: "pointer" as any }]}
    >
      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
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

export default function NgoHome() {
  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const loadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      // UPDATED: Fetching from 'food_listings' instead of 'listings'
      const { data: listingsData } = await supabase
        .from("food_listings")
        .select(
          `
          *,
          hotel:profiles!food_listings_hotel_id_fkey(name, phone)
        `,
        )
        .eq("status", "available") // Only show available food
        .order("created_at", { ascending: false })
        .limit(10);

      if (listingsData) {
        const formattedListings = listingsData.map((listing: any) => ({
          ...listing,
          owner_name: listing.hotel?.name, // Mapped to hotel name
          owner_phone: listing.hotel?.phone,
        }));
        setListings(formattedListings);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  // Helper for expiry time display
  const getExpiryDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.ceil(diff / (1000 * 3600));

    if (hours < 0) return "Expired";
    if (hours < 24) return `Expires in ${hours}h`;
    return `Expires ${date.toLocaleDateString()}`;
  };

  const renderListingCard = (item: any) => (
    <ScalePressable
      key={item.id}
      style={styles.listingCard}
      onPress={() => {
        setSelectedListing(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.cardImageContainer}>
        <Image
          source={{
            uri:
              item.images?.[0] ||
              "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
          }}
          style={styles.cardImage}
          resizeMode="cover"
        />
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>FRESH</Text>
        </View>

        {/* UPDATED: Shows Quantity (kg) instead of Rent (Price) */}
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{item.quantity_kg}</Text>
          <Text style={styles.periodText}>kg</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Ionicons name="chevron-forward-circle" size={24} color="#E5E7EB" />
        </View>

        {/* UPDATED: Added Expiry Time Row */}
        <View style={[styles.listingRow, { marginBottom: 6 }]}>
          <Ionicons name="time-outline" size={16} color="#F59E0B" />
          <Text style={[styles.listingAddress, { color: "#B45309" }]}>
            {getExpiryDisplay(item.expiry_time)}
          </Text>
        </View>

        <View style={styles.listingRow}>
          <Ionicons name="location-outline" size={16} color="#6B7280" />
          <Text style={styles.listingAddress} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
      </View>
    </ScalePressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          <View style={styles.headerContainer}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>Welcome back,</Text>
                <Text style={styles.name}>
                  {profile?.name?.split(" ")[0] || "NGO"}
                </Text>
              </View>
              <ScalePressable style={styles.avatarContainer} onPress={() => {}}>
                <Ionicons name="person" size={24} color="#007AFF" />
              </ScalePressable>
            </View>

            {/* ROUTE REPLACED: /seeker/all-listings -> /ngo/all-listings */}
            <ScalePressable
              style={styles.searchBar}
              onPress={() => router.push("/(ngo)/all-listings")}
              activeScale={1}
            >
              <Ionicons name="search" size={20} color="#111827" />
              <View style={styles.searchTextContainer}>
                <Text style={styles.searchTitle}>Find Food</Text>
                <Text style={styles.searchSubtitle} numberOfLines={2}>
                  {profile?.address
                    ? `${profile.address.split(",").slice(0, 2).join(", ")}`
                    : "Tap filter to set pickup location"}
                </Text>
              </View>
              {/* ROUTE REPLACED: /seeker/update-location -> /ngo/update-location */}
              <Pressable
                onPress={() => router.push("/(ngo)/update-location")}
                hitSlop={10}
                style={styles.searchFilterIcon}
              >
                <Ionicons name="options-outline" size={18} color="#111827" />
              </Pressable>
            </ScalePressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Explore</Text>
            <View style={styles.actionsGrid}>
              {[
                // UPDATED ROUTES: Using /ngo/ prefix
                {
                  icon: "map",
                  title: "Map View",
                  sub: "Browse area",
                  path: "/(ngo)/map-view",
                  color: "#3B82F6",
                },
                {
                  icon: "chatbubbles",
                  title: "Messages",
                  sub: "Chats",
                  path: "/(tabs)/messages",
                  color: "#10B981",
                },
                {
                  icon: "notifications",
                  title: "Alerts",
                  sub: "Updates",
                  path: "/(tabs)/notifications",
                  color: "#F59E0B",
                },
                {
                  icon: "navigate",
                  title: "Location",
                  sub: "Change area",
                  path: "/(ngo)/update-location",
                  color: "#8B5CF6",
                },
              ].map((action, index) => (
                <ScalePressable
                  key={index}
                  style={styles.actionCard}
                  onPress={() => router.push(action.path as any)}
                >
                  <View
                    style={[
                      styles.actionIconContainer,
                      { backgroundColor: `${action.color}15` },
                    ]}
                  >
                    <Ionicons
                      name={action.icon as any}
                      size={22}
                      color={action.color}
                    />
                  </View>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionSubtitle}>{action.sub}</Text>
                </ScalePressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Donations</Text>
              {listings.length > 0 && (
                // ROUTE REPLACED: /seeker/all-listings -> /ngo/all-listings
                <Pressable
                  onPress={() => router.push("/(ngo)/all-listings")}
                  hitSlop={10}
                >
                  <Text style={styles.sectionLink}>See all</Text>
                </Pressable>
              )}
            </View>

            {loading && !refreshing ? (
              <View>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : listings.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                  <Ionicons
                    name="fast-food-outline"
                    size={32}
                    color="#9CA3AF"
                  />
                </View>
                <Text style={styles.emptyTitle}>No food found</Text>
                <Text style={styles.emptySubtitle}>
                  We couldn't find any available food in your area just yet.
                </Text>
                {/* ROUTE REPLACED: /seeker/update-location -> /ngo/update-location */}
                <ScalePressable
                  style={styles.ctaButton}
                  onPress={() => router.push("/(ngo)/update-location")}
                >
                  <Text style={styles.ctaText}>Explore nearby areas</Text>
                </ScalePressable>
              </View>
            ) : (
              <View style={styles.listingsGrid}>
                {listings.map((item) => renderListingCard(item))}
              </View>
            )}
          </View>

          <ScalePressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </ScalePressable>
        </View>
      </ScrollView>

      <ListingDetailModal
        visible={modalVisible}
        listing={selectedListing}
        onClose={() => setModalVisible(false)}
        isOwner={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  scrollContent: { paddingBottom: 40, alignItems: "center" },
  contentWrapper: { width: "100%", maxWidth: 1200, alignSelf: "center" },

  headerContainer: {
    backgroundColor: "#FFFFFF",
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 2,
  },
  name: { fontSize: 24, fontWeight: "800", color: "#111827" },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    boxShadow: "0px 3px 6px rgba(0, 0, 0, 0.08)",
  },
  searchTextContainer: { flex: 1, marginLeft: 12 },
  searchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  searchSubtitle: { fontSize: 12, color: "#6B7280" },
  searchFilterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer" as any,
  },

  section: { padding: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  sectionLink: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
    cursor: "pointer" as any,
  },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  actionSubtitle: { fontSize: 12, color: "#6B7280" },

  listingsGrid: { gap: 24 },
  listingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
  },
  cardImageContainer: { height: 200, width: "100%", position: "relative" },
  cardImage: { width: "100%", height: "100%" },
  statusBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 10, fontWeight: "800", color: "#059669" },
  priceTag: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  periodText: { fontSize: 11, color: "#E5E7EB", marginLeft: 2 },
  cardContent: { padding: 16 },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  listingTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  listingRow: { flexDirection: "row", alignItems: "center" },
  listingAddress: { fontSize: 14, color: "#6B7280", marginLeft: 4, flex: 1 },

  skeletonCard: {
    height: 280,
    width: "100%",
    backgroundColor: "#E5E7EB",
    borderRadius: 20,
    marginBottom: 20,
  },

  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
  },
  emptyIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
  },
  ctaText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },

  signOutButton: {
    marginHorizontal: 24,
    marginTop: 10,
    padding: 16,
    alignItems: "center",
  },
  signOutText: { color: "#EF4444", fontSize: 15, fontWeight: "600" },
});
