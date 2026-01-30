import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// 1. Setup Handler (Foreground notifications)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowAlert: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 2. Setup Channel (Android)
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
  }
}

// 3. Get Fresh Token
export async function getFreshPushToken() {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    // Get Project ID dynamically from app.config.js or hardcode it
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'a45d3b8c-ce51-474f-8074-c02be2936e7f';

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId, 
    });
    
    console.log(' FRESH PUSH TOKEN:', tokenResponse.data);
    return tokenResponse.data;
  } catch (error) {
    console.error("Error fetching push token:", error);
    return null;
  }
}

export async function registerForPushNotifications() {
  await setupNotificationChannel();
  return await getFreshPushToken();
}

// ---------------------------------------------------------
//  NOTIFICATION LOGIC FOR FOOD DONATION
// ---------------------------------------------------------

/**
 * Notify NGOs when a Hotel posts new food.
 * Note: You need a Postgres Function 'get_nearby_ngos' in Supabase for this to work perfectly.
 */
export async function sendNotificationToNearbyUsers(
  listingId: string,
  listingData: {
    title: string;
    latitude: number;
    longitude: number;
    // Changed rent -> quantity/details
    quantity?: number; 
    foodType?: string;
  }
) {
  console.log(" STARTING NOTIFICATION SEND...");
  
  try {
    // RPC Call: Finds profiles with role='ngo' within radius
    const { data: nearbyUsers, error } = await supabase
      .rpc('get_nearby_ngos', { // Ensure this function exists in DB
        listing_lat: listingData.latitude,
        listing_lon: listingData.longitude,
      });

    if (error) {
      console.warn("RPC 'get_nearby_ngos' might be missing. Skipping notifications.", error.message);
      return { success: false, error };
    }

    if (!nearbyUsers || nearbyUsers.length === 0) {
      console.log("No NGOs found nearby.");
      return { success: true, count: 0 };
    }

    const messages = nearbyUsers.map((user: any) => ({
      to: user.push_token,
      sound: 'default',
      title: '🍎 Fresh Food Nearby!',
      body: `${listingData.quantity || 'Some'}kg food available at ${listingData.title}. Approx ${user.distance.toFixed(1)} km away.`,
      data: {
        type: 'new_food_listing',
        listingId,
        distance: user.distance,
      },
    }));

    // Batch sending (Expo limit is 100 per batch)
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    }

    return { success: true, count: messages.length };
  } catch (error) {
    console.error('Error sending notifications:', error);
    return { success: false, error };
  }
}

/**
 * Optional: Notify Hotel when an NGO claims food.
 * Can be called from the NGO side when they press "Claim".
 */
export async function notifyHotelOfClaim(
  hotelPushToken: string, 
  foodTitle: string,
  ngoName: string
) {
  if (!hotelPushToken) return;

  try {
    const message = {
      to: hotelPushToken,
      sound: 'default',
      title: '✅ Food Claimed!',
      body: `${ngoName} has claimed "${foodTitle}". They will contact you shortly.`,
      data: { type: 'food_claimed' },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify([message]),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error notifying hotel:', error);
    return { success: false, error };
  }
}

export function setupNotificationListener(callback: (notification: any) => void) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function setupNotificationResponseListener(callback: (response: any) => void) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}