import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GameProvider } from "@/hooks/use-game-store";
import { ThemeProvider } from "@/hooks/use-theme";
import { trpc, trpcClient } from "@/lib/trpc";
import { RealtimeGroupsProvider } from "@/hooks/use-realtime-groups";
import { useSession } from "@/hooks/use-session";

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
      <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
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
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen 
        name="settings" 
        options={{ 
          presentation: "modal",
          headerShown: true,
          title: "Settings"
        }} 
      />
      <Stack.Screen name="group-details" options={{ presentation: "modal" }} />
      <Stack.Screen name="group-browser" options={{ presentation: "modal" }} />
      <Stack.Screen 
        name="reset-password" 
        options={{ 
          headerShown: true,
          title: "Reset Password"
        }} 
      />
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
            <SessionRealtimeWrapper>
              <GestureHandlerRootView style={styles.gestureHandler}>
                <RootLayoutNav />
              </GestureHandlerRootView>
            </SessionRealtimeWrapper>
          </GameProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

function SessionRealtimeWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  
  return (
    <RealtimeGroupsProvider userId={user?.id}>
      {children}
    </RealtimeGroupsProvider>
  );
}
