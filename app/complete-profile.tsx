import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";
const maxWidth = isWeb ? 480 : width;

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

export default function CompleteProfile() {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"hotel" | "ngo" | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    if (!name || !role) {
      Alert.alert("Missing info", "Please fill all required fields");
      return;
    }

    if (role === "hotel" && !phone) {
      Alert.alert(
        "Phone required",
        "Hotels/Restaurants must add a contact number",
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not found");

      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        name,
        role,
        phone: phone || null,
      });
      if (error) throw error;

      triggerNotificationHaptic(Haptics.NotificationFeedbackType.Success);

      // ✅ FIXED ROUTING
      if (role === "hotel") {
        router.replace("/(hotel)");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong");
      triggerNotificationHaptic(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        isWeb && { maxWidth, alignSelf: "center", width: "100%" },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={!isWeb}
    >
      <View style={styles.header}>
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: "https://img.icons8.com/clouds/200/user-group-man-woman.png",
            }}
            style={styles.headerImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Complete Profile</Text>
        <Text style={styles.subtitle}>
          Choose your role to join the Second Serve network
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Organization / Name</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="business-outline"
              size={20}
              color="#6B7280"
              style={{ marginRight: 12 }}
            />
            <TextInput
              placeholder="e.g. Grand Hotel or Feeding Hands NGO"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>I am a...</Text>
          <View style={styles.roleRow}>
            {/* NGO Role */}
            <Pressable
              style={[styles.roleButton, role === "ngo" && styles.roleSelected]}
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setRole("ngo");
              }}
            >
              <View style={styles.roleContent}>
                <Image
                  source={{
                    uri: "https://img.icons8.com/clouds/200/charity.png",
                  }}
                  style={styles.roleImage}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.roleText,
                    role === "ngo" && styles.roleTextSelected,
                  ]}
                >
                  NGO
                </Text>
                <Text style={styles.roleDescription}>Collecting food</Text>
              </View>
            </Pressable>

            {/* Hotel Role */}
            <Pressable
              style={[
                styles.roleButton,
                role === "hotel" && styles.roleSelected,
              ]}
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setRole("hotel");
              }}
            >
              <View style={styles.roleContent}>
                <Image
                  source={{
                    uri: "https://img.icons8.com/clouds/200/restaurant-building.png",
                  }}
                  style={styles.roleImage}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.roleText,
                    role === "hotel" && styles.roleTextSelected,
                  ]}
                >
                  Hotel
                </Text>
                <Text style={styles.roleDescription}>Donating food</Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={[styles.inputContainer, styles.fadeIn]}>
          <Text style={styles.label}>
            Phone Number {role === "hotel" ? "(Required)" : "(Optional)"}
          </Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="call-outline"
              size={20}
              color="#6B7280"
              style={{ marginRight: 12 }}
            />
            <TextInput
              placeholder="Contact number for pickup"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <Text style={styles.helperText}>Used to coordinate food pickups</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={["#007AFF", "#0051D5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Get Started</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: isWeb ? 60 : 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  imageContainer: {
    marginBottom: 20,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  headerImage: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
    color: "#111827",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "500",
    maxWidth: "80%",
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#374151",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    height: "100%",
  },
  helperText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 6,
    marginLeft: 4,
  },
  roleRow: {
    flexDirection: "row",
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  roleSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#007AFF",
  },
  roleContent: {
    alignItems: "center",
  },
  roleImage: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  roleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  roleTextSelected: {
    color: "#007AFF",
  },
  roleDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  fadeIn: {
    opacity: 1,
  },
  submitButton: {
    height: 56,
    borderRadius: 12,
    marginTop: 16,
    overflow: "hidden",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 17,
  },
});
