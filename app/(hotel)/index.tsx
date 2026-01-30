import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
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
const triggerSelectionHaptic = () => {
  if (Platform.OS !== "web") {
    Haptics.selectionAsync();
  }
};
const { width } = Dimensions.get("window");

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
      style={{ width: style?.width ? style.width : undefined }}
    >
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

export default function HotelHome() {
  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0); // Changed from interested count
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

      // UPDATED: Fetch from food_listings
      const { data: listingsData } = await supabase
        .from("food_listings")
        .select("*")
        .eq("hotel_id", user.id) // Changed owner_id -> hotel_id
        .order("created_at", { ascending: false });

      if (listingsData) {
        setListings(listingsData);
        // Calculate Total Quantity Donated instead of Interested Count
        const totalKg = listingsData.reduce(
          (sum, listing) => sum + (listing.quantity_kg || 0),
          0,
        );
        setTotalQuantity(totalKg);
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
    triggerNotificationHaptic(Haptics.NotificationFeedbackType.Success);
    await supabase.auth.signOut();
    router.replace("./(auth)/login");
  };

  // Navigation (Updated Routes)
  const navigateToCreateListing = () => {
    triggerSelectionHaptic();
    router.push("./(hotel)/create-listing");
  };
  const navigateToMyListings = () => {
    triggerSelectionHaptic();
    router.push("./(hotel)/listings");
  };
  const navigateToMessages = () => {
    triggerSelectionHaptic();
    router.push("./(hotel)/messages"); // Changed from owner -> hotel
  };

  const openListingDetail = (listing: any) => {
    triggerSelectionHaptic();
    setSelectedListing(listing);
    setModalVisible(true);
  };

  const handleEditListing = () => {
    Alert.alert("Edit Listing", "Edit functionality coming soon!");
  };

  const handleDeleteListing = async () => {
    if (!selectedListing) return;
    try {
      const { error } = await supabase
        .from("food_listings")
        .delete()
        .eq("id", selectedListing.id);
      if (error) throw error;
      triggerNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // Helper for Expiry
  const getExpiryDisplay = (dateString: string) => {
    const diff = new Date(dateString).getTime() - new Date().getTime();
    const hours = Math.ceil(diff / (1000 * 3600));
    if (hours < 0) return "Expired";
    return `${hours}h left`;
  };

  const renderListingCard = (item: any) => (
    <ScalePressable
      key={item.id}
      style={styles.listingCard}
      onPress={() => openListingDetail(item)}
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

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === "available"
                  ? "rgba(255, 255, 255, 0.95)"
                  : "rgba(243, 244, 246, 0.95)",
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: item.status === "available" ? "#059669" : "#4B5563" },
            ]}
          >
            {item.status?.toUpperCase()}
          </Text>
        </View>

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

        <View style={styles.listingRow}>
          <Ionicons name="time-outline" size={16} color="#F59E0B" />
          <Text style={[styles.listingAddress, { color: "#B45309" }]}>
            {getExpiryDisplay(item.expiry_time)}
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
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.name}>
                {profile?.name?.split(" ")[0] || "Partner"}
              </Text>
            </View>
            <ScalePressable
              style={styles.avatarContainer}
              onPress={() => triggerSelectionHaptic()}
            >
              <Ionicons name="business" size={24} color="#007AFF" />
            </ScalePressable>
          </View>

          <ScalePressable
            style={styles.createButtonContainer}
            onPress={navigateToCreateListing}
          >
            <LinearGradient
              colors={["#059669", "#065F46"]} // Green for Donation
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createGradient}
            >
              <View style={styles.createIconBg}>
                <Ionicons name="add" size={24} color="#059669" />
              </View>
              <View>
                <Text style={styles.createTitle}>Donate Food</Text>
                <Text style={styles.createSubtitle}>Help NGOs nearby</Text>
              </View>
              <Ionicons
                name="arrow-forward"
                size={20}
                color="#D1FAE5"
                style={{ marginLeft: "auto" }}
              />
            </LinearGradient>
          </ScalePressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {listings.filter((l) => l.status === "available").length}
              </Text>
              <Text style={styles.statLabel}>Active Donations</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalQuantity.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Total Kg Listed</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage</Text>
          <View style={styles.actionsGrid}>
            {[
              {
                icon: "list",
                title: "My Listings",
                sub: "View all",
                fn: navigateToMyListings,
                color: "#3B82F6",
              },
              {
                icon: "chatbubbles",
                title: "Messages",
                sub: "Chat",
                fn: navigateToMessages,
                color: "#10B981",
              },
            ].map((action, index) => (
              <ScalePressable
                key={index}
                style={styles.actionCard}
                onPress={action.fn}
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
            <Text style={styles.sectionTitle}>Recent Posts</Text>
            {listings.length > 0 && (
              <Pressable onPress={navigateToMyListings} hitSlop={10}>
                <Text style={styles.sectionLink}>See all</Text>
              </Pressable>
            )}
          </View>

          {loading && !refreshing ? (
            <View>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : listings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="fast-food" size={32} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>No food listed</Text>
              <Text style={styles.emptySubtitle}>
                Post your first donation to start connecting with NGOs.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 24 }}>
              {listings.slice(0, 3).map((item) => renderListingCard(item))}
            </View>
          )}
        </View>

        <ScalePressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </ScalePressable>
      </ScrollView>

      <ListingDetailModal
        visible={modalVisible}
        listing={selectedListing}
        onClose={() => {
          setModalVisible(false);
          loadData();
        }}
        isOwner={true}
        onEdit={handleEditListing}
        onDelete={handleDeleteListing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  headerContainer: {
    backgroundColor: "#FFFFFF",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },

  // Create Button
  createButtonContainer: {
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  createIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  createTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  createSubtitle: {
    fontSize: 12,
    color: "#D1FAE5",
  },

  // Sections
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  sectionLink: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    // Depth
    borderBottomWidth: 3,
    borderBottomColor: "#D1D5DB",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    textAlign: "center",
  },

  // Action Cards (Depth Style)
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    width: (width - 52) / 2, // 2 column layout
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderBottomWidth: 4, // Depth effect
    borderBottomColor: "#D1D5DB",
    shadowColor: "#9CA3AF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
  actionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },

  // Listing Cards (Vertical with Images)
  listingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#D1D5DB", // Darker border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardImageContainer: {
    height: 180,
    width: "100%",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  statusBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  priceTag: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  periodText: {
    fontSize: 12,
    color: "#E5E7EB",
    marginLeft: 2,
  },
  cardContent: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  listingAddress: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 6,
    flex: 1,
  },
  cardStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  interestedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    gap: 6,
  },
  interestedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },

  // Skeleton
  skeletonCard: {
    height: 280,
    width: "100%",
    backgroundColor: "#E5E7EB",
    borderRadius: 20,
    marginBottom: 20,
  },

  // Empty State
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

  // Sign Out
  signOutButton: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 16,
    alignItems: "center",
  },
  signOutText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "600",
  },
});
