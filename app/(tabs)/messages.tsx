import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

// Helper function for haptics that works on all platforms
const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
};

interface Conversation {
  other_user_id: string;
  other_user_name: string;
  listing_id: string;
  listing_title: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export default function NgoMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, []),
  );

  const loadConversations = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Get all messages where user is involved
      // UPDATED: listing:listings -> listing:food_listings
      const { data: messages, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          sender:profiles!messages_sender_id_fkey(name),
          receiver:profiles!messages_receiver_id_fkey(name),
          listing:food_listings(title) 
        `,
        )
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading messages:", error);
        throw error;
      }

      // Group messages into conversations
      const conversationMap = new Map<string, Conversation>();

      messages?.forEach((msg: any) => {
        const otherUserId =
          msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        // UPDATED: Default name 'Owner' -> 'Hotel'
        const otherUserName =
          msg.sender_id === user.id
            ? msg.receiver?.name || "Hotel"
            : msg.sender?.name || "User";

        const key = `${otherUserId}-${msg.listing_id}`;

        if (!conversationMap.has(key)) {
          conversationMap.set(key, {
            other_user_id: otherUserId,
            other_user_name: otherUserName,
            listing_id: msg.listing_id,
            listing_title: msg.listing?.title || "Unknown Food Listing",
            last_message: msg.content || msg.message, // Handle both 'content' (new schema) and 'message' (old schema) keys if migrating
            last_message_time: msg.created_at,
            unread_count: msg.receiver_id === user.id && !msg.is_read ? 1 : 0, // Changed read -> is_read based on schema
          });
        } else {
          const conv = conversationMap.get(key)!;
          if (msg.receiver_id === user.id && !msg.is_read) {
            conv.unread_count++;
          }
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = (conv: Conversation) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    // UPDATED: Path /seeker/ -> /ngo/
    router.push({
      pathname: "/(ngo)/conversation/[id]" as any,
      params: {
        id: conv.other_user_id,
        listingId: conv.listing_id,
        userName: conv.other_user_name,
        listingTitle: conv.listing_title,
      },
    });
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.other_user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.listing_title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <Pressable
      style={({ pressed }) => [
        styles.conversationCard,
        pressed && styles.conversationCardPressed,
      ]}
      onPress={() => openConversation(item)}
    >
      <View style={styles.avatarContainer}>
        <Ionicons name="person" size={24} color="#007AFF" />
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count}</Text>
          </View>
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.userName}>{item.other_user_name}</Text>
          <Text style={styles.timestamp}>
            {formatTime(item.last_message_time)}
          </Text>
        </View>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {item.listing_title}
        </Text>
        <Text
          style={[
            styles.lastMessage,
            item.unread_count > 0 && styles.unreadMessage,
          ]}
          numberOfLines={1}
        >
          {item.last_message}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
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

      {filteredConversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? "No conversations found" : "No chats yet"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? "Try a different search term"
              : "Claim food to start chatting with hotels"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => `${item.other_user_id}-${item.listing_id}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
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
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  conversationCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    position: "relative",
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  conversationContent: {
    flex: 1,
    marginRight: 12,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  timestamp: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  listingTitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: "#6B7280",
  },
  unreadMessage: {
    fontWeight: "600",
    color: "#111827",
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
