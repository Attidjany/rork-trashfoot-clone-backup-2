// app/_layout.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GameProvider } from "@/hooks/use-game-store";
import { ThemeProvider } from "@/hooks/use-theme";
import { trpc, trpcClient } from "@/lib/trpc";
import { useSession } from "@/hooks/use-session";

// Import once at the root so Supabase works reliably on web/Expo
import "react-native-url-polyfill/auto";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#fff",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="match-details"
        options={{ title: "Match Details", presentation: "modal" }}
      />
      <Stack.Screen
        name="create-competition"
        options={{ title: "New Competition", presentation: "modal" }}
      />
      <Stack.Screen name="admin" options={{ presentation: "modal" }} />
      <Stack.Screen name="super-admin-login" options={{ presentation: "modal" }} />
      <Stack.Screen name="auth" options={{ presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      <Stack.Screen name="group-details" options={{ presentation: "modal" }} />
      <Stack.Screen name="group-browser" options={{ presentation: "modal" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  gestureHandler: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();

  // Keep your splash logic
  useEffect(() => {
    const prepare = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
        SplashScreen.hideAsync();
      }
    };
    prepare();
  }, []);

  // NEW: gate navigation based on Supabase session (no more onboarding)
  useEffect(() => {
    if (!isReady || loading) return;

    const inAuth = pathname?.startsWith("/auth");
    const inOnboarding = pathname === "/onboarding" || pathname?.startsWith("/onboarding");
    const isRoot = pathname === "/" || pathname === "" || pathname == null;

    if (!user) {
      // Not signed in → force to /auth (avoid loops)
      if (!inAuth) router.replace("/auth");
      return;
    }

    // Signed in → avoid /auth and any obsolete onboarding route
    if (inAuth || inOnboarding || isRoot) {
      router.replace("/(tabs)/home");
    }
  }, [isReady, loading, user, pathname, router]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <GameProvider>
            <GestureHandlerRootView style={styles.gestureHandler}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </GameProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
