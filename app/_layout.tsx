import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ---------------- AUTH ----------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // ---------------- ROUTING ----------------
  useEffect(() => {
    if (!navState?.key || loading) return;

    const root = segments[0];

    // NOT LOGGED IN
    if (!session) {
      if (root !== "(auth)") {
        router.replace("/(auth)/login");
      }
      return;
    }

    routeByRole(session.user.id);
  }, [session, loading, navState?.key, segments]);

  const routeByRole = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const root = segments[0];

    // NO PROFILE
    if (!profile) {
      if (root !== "complete-profile") {
        router.replace("/complete-profile");
      }
      return;
    }

    // HOTEL → MUST EXIST
    if (profile.role === "hotel") {
      if (root !== "(hotel)") {
        router.replace("/(hotel)/index" as any);
      }
      return;
    }

    // NGO → MUST EXIST
    if (profile.role === "ngo") {
      if (root !== "(ngo)") {
        router.replace("/(ngo)/map-view" as any);
      }
    }
  };

  // ---------------- LOADING ----------------
  if (loading || !navState?.key) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ---------------- STACK ----------------
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(hotel)" />
      <Stack.Screen name="(ngo)" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="modal" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
