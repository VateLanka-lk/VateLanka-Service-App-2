import React, { useState, useEffect, useRef } from "react";
import { View, ActivityIndicator, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import {
  createStackNavigator,
  CardStyleInterpolators,
} from "@react-navigation/stack";
import WelcomeScreen from "./components/Screens/WelcomeScreen";
import DriverLoginScreen from "./components/Screens/DriverLoginScreen";

import DriverHomeScreen from "./components/Screens/Driver/DriverHomeScreen";
import DailyReport from './components/Screens/Driver/DailyReport';
import MapViewScreen from "./components/Screens/Driver/MapViewScreen";
import ConfirmStopScreen from "./components/Screens/Driver/ConfirmStopScreen";
import AssignedTicketsScreen from "./components/Screens/Driver/AssignedTicketsScreen";
import TicketDetailScreen from "./components/Screens/Driver/TicketDetailScreen";
import CompleteTicketScreen from "./components/Screens/Driver/CompleteTicketScreen";

import { auth } from "./components/utils/firebaseConfig";
import { getDriverSession } from "./components/utils/authStorage";
import { COLORS } from "./components/utils/Constants";
import CustomText from "./components/utils/CustomText";
import "react-native-gesture-handler";

const Stack = createStackNavigator();

const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    }}
  >
    <Stack.Screen name="Welcome" component={WelcomeScreen} />
    <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
  </Stack.Navigator>
);

const DriverStack = ({ userProfile }) => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    }}
  >

    
   <Stack.Screen
      name="DriverHome"
      component={DriverHomeScreen}
      initialParams={{ profile: userProfile }}
    />
    <Stack.Screen name="MapView" component={MapViewScreen} />
    <Stack.Screen
      name="ConfirmStop"
      component={ConfirmStopScreen}
      options={{
        cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
        presentation: "transparentModal",
      }}
    />
    {/* Add these new screens */}
    <Stack.Screen name="AssignedTickets" component={AssignedTicketsScreen} />
    <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
    <Stack.Screen 
      name="CompleteTicket" 
      component={CompleteTicketScreen}
      options={{
        cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
      }}
    />
    {/* Add the DailyReport screen here */}
    <Stack.Screen name="DailyReport" component={DailyReport} />
  </Stack.Navigator>
);
export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [hasError, setHasError] = useState(false);
  const sessionCheckInterval = useRef(null);

  useEffect(() => {
    const errorHandler = (error, isFatal) => {
      if (isFatal) {
        console.error("FATAL ERROR:", error);
        setHasError(true);
      } else {
        console.error("NON-FATAL ERROR:", error);
      }
    };

    if (__DEV__) {
      const originalGlobalHandler = global.ErrorUtils.getGlobalHandler();
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        errorHandler(error, isFatal);
        originalGlobalHandler(error, isFatal);
      });

      return () => {
        global.ErrorUtils.setGlobalHandler(originalGlobalHandler);
      };
    }

    return () => {};
  }, []);

  // Function to check for a valid session
  const checkForValidSession = async () => {
    try {
      const driverSession = await getDriverSession();

      if (driverSession && driverSession.profile) {
        console.log("Valid driver session found in session check");
        setUser(driverSession);
        setUserProfile(driverSession.profile);

        if (sessionCheckInterval.current) {
          clearInterval(sessionCheckInterval.current);
          sessionCheckInterval.current = null;
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  };

  // Authentication initialization
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("Checking for existing driver session...");
        const found = await checkForValidSession();

        if (!found) {
          console.log("No valid driver session found on init");
        }
      } catch (error) {
        console.error("Authentication initialization error:", error);
      } finally {
        setInitializing(false);
      }
    };

    // Initialize auth and set a timeout to prevent hanging
    const initPromise = initializeAuth();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log("Auth initialization timed out");
        resolve();
      }, 5000);
    });

    Promise.race([initPromise, timeoutPromise]).then(() => {
      if (initializing) {
        setInitializing(false);
      }
    });

    // Set up auth state listener
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log(
        "Auth state changed:",
        firebaseUser ? "User logged in" : "No user"
      );

      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);

        // Clear any active session checking
        if (sessionCheckInterval.current) {
          clearInterval(sessionCheckInterval.current);
          sessionCheckInterval.current = null;
        }

        if (initializing) setInitializing(false);
        return;
      }

      // Start checking for session after a successful Firebase login
      const found = await checkForValidSession();

      if (!found) {
        console.log("Starting session check interval...");

        if (sessionCheckInterval.current) {
          clearInterval(sessionCheckInterval.current);
        }

        // Check every 1 second for up to 10 seconds
        let attempts = 0;
        const maxAttempts = 10;

        sessionCheckInterval.current = setInterval(async () => {
          attempts++;
          console.log(`Session check attempt ${attempts}/${maxAttempts}`);

          const sessionFound = await checkForValidSession();

          if (sessionFound || attempts >= maxAttempts) {
            clearInterval(sessionCheckInterval.current);
            sessionCheckInterval.current = null;

            if (!sessionFound && attempts >= maxAttempts) {
              console.log("Session check timed out after maximum attempts");
            }
          }
        }, 1000);
      }

      if (initializing) setInitializing(false);
    });

    return () => {
      unsubscribe();
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
    };
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
    };
  }, []);

  // Error UI render
  if (hasError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <CustomText
          style={{ fontSize: 18, marginBottom: 20, textAlign: "center" }}
        >
          Something went wrong. Please restart the app.
        </CustomText>
        <TouchableOpacity
          style={{
            padding: 12,
            backgroundColor: COLORS.primary,
            borderRadius: 8,
          }}
          onPress={() => setHasError(false)}
        >
          <CustomText style={{ color: COLORS.white }}>Try Again</CustomText>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading state
  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.white,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Main app rendering
  return (
    <NavigationContainer>
      {!user ? <AuthStack /> : <DriverStack userProfile={userProfile} />}
    </NavigationContainer>
  );
}