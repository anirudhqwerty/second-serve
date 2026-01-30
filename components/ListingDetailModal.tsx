import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 300;

interface ListingDetailModalProps {
  visible: boolean;
  listing: any;
  onClose: () => void;
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function ListingDetailModal({
  visible,
  listing,
  onClose,
  isOwner,
  onEdit,
  onDelete,
}: ListingDetailModalProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
   
  const scrollViewRef = useRef<ScrollView>(null);
  const slideshowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible && !isOwner && listing) {
      checkIfSaved();
    }
  }, [visible, listing]);

  useEffect(() => {
    if (visible && !imageModalVisible && listing?.images && listing.images.length > 1) {
      startSlideshow();
    } else {
      stopSlideshow();
    }

    return () => stopSlideshow();
  }, [visible, imageModalVisible, listing?.images]);

  const startSlideshow = () => {
    stopSlideshow();
    slideshowIntervalRef.current = setInterval(() => {
      setCurrentImageIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % listing.images.length;
        
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: nextIndex * SCREEN_WIDTH,
            animated: true,
          });
        }
        
        return nextIndex;
      });
    }, 3000);
  };

  const stopSlideshow = () => {
    if (slideshowIntervalRef.current) {
      clearInterval(slideshowIntervalRef.current);
      slideshowIntervalRef.current = null;
    }
  };

  const checkIfSaved = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // UPDATED: Check 'saved_food_listings'
      const { data } = await supabase
        .from('saved_food_listings')
        .select('id')
        .eq('ngo_id', user.id) // Assuming current user is NGO
        .eq('food_listing_id', listing.id)
        .maybeSingle();

      setIsSaved(!!data);
    } catch (error) {
      setIsSaved(false);
    }
  };

  const toggleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to save listings');
        return;
      }

      if (isSaved) {
        // UPDATED: Delete from 'saved_food_listings'
        const { error } = await supabase
          .from('saved_food_listings')
          .delete()
          .eq('ngo_id', user.id)
          .eq('food_listing_id', listing.id);

        if (error) throw error;

        // Optional: If you track interested count on food_listings
        /* await supabase.rpc('decrement_listing_interested', {
          listing_id: listing.id
        }); */

        setIsSaved(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // UPDATED: Insert into 'saved_food_listings'
        const { error } = await supabase
          .from('saved_food_listings')
          .insert({
            ngo_id: user.id,
            food_listing_id: listing.id,
          });

        if (error) throw error;

        /* await supabase.rpc('increment_listing_interested', {
          listing_id: listing.id
        }); */

        setIsSaved(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved!', 'This donation has been bookmarked.');
      }
    } catch (error: any) {
      console.error('Error toggling save:', error);
      Alert.alert('Error', 'Failed to save listing');
    }
  };

  const handleCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      let phoneNumber = listing?.owner_phone;
      
      // If phone not in listing object, fetch from hotel profile
      if (!phoneNumber && listing?.hotel_id) { // Changed owner_id -> hotel_id
        const { data: ownerProfile, error } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', listing.hotel_id)
          .maybeSingle();
        
        if (error) console.error('Error fetching hotel profile:', error);
        phoneNumber = ownerProfile?.phone;
      }
      
      if (!phoneNumber) {
        Alert.alert(
          'No Phone Number', 
          'The hotel has not provided a contact number. Try sending a message.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send Message', onPress: handleMessage }
          ]
        );
        return;
      }

      const cleanedPhone = phoneNumber.trim().replace(/\s+/g, '');
      const phoneUrl = `tel:${cleanedPhone}`;
      
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (!canOpen) {
        Alert.alert('Error', 'Unable to make phone calls on this device');
        return;
      }
      
      await Linking.openURL(phoneUrl);
    } catch (error: any) {
      console.error('Error making call:', error);
      Alert.alert('Call Error', 'Unable to place call.');
    }
  };

  const handleMessage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to contact hotels');
        return;
      }

      onClose();
      
      setTimeout(() => {
        // UPDATED: Path to /ngo/conversation or /hotel/conversation depending on role
        // Assuming this modal is used by both, but primarily NGO viewing Hotel listing here
        const basePath = isOwner ? '/hotel' : '/ngo';
        
        router.push({
          pathname: `${basePath}/conversation/[id]` as any,
          params: {
            id: listing.hotel_id || listing.owner_id, // Handle both naming conventions
            listingId: listing.id,
            userName: listing.owner_name || 'Hotel',
            listingTitle: listing.title,
          },
        });
      }, 100);
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this donation post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDelete) onDelete();
            onClose();
          },
        },
      ]
    );
  };

  const openImageModal = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalImageIndex(index);
    setImageModalVisible(true);
  };

  const closeImageModal = () => {
    setImageModalVisible(false);
    if (visible && listing?.images && listing.images.length > 1) {
      startSlideshow();
    }
  };

  // Helper for Expiry Display
  const getExpiryDisplay = (dateString: string) => {
    if (!dateString) return '';
    const diff = new Date(dateString).getTime() - new Date().getTime();
    const hours = Math.ceil(diff / (1000 * 3600));
    if (hours < 0) return 'Expired';
    if (hours < 24) return `Expires in ${hours}h`;
    return `Expires ${new Date(dateString).toLocaleDateString()}`;
  };

  if (!listing) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#111827" />
            </Pressable>
            {!isOwner && (
              <Pressable onPress={toggleSave} style={styles.saveButton}>
                <Ionicons
                  name={isSaved ? "bookmark" : "bookmark-outline"} // Changed heart to bookmark for "Saved"
                  size={28}
                  color={isSaved ? "#007AFF" : "#111827"}
                />
              </Pressable>
            )}
          </View>

          <ScrollView style={styles.scrollView}>
            {listing.images && listing.images.length > 0 && (
              <View style={styles.imageContainer}>
                <ScrollView
                  ref={scrollViewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.floor(
                      event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                    );
                    setCurrentImageIndex(index);
                  }}
                  onScrollBeginDrag={stopSlideshow}
                  onScrollEndDrag={startSlideshow}
                >
                  {listing.images.map((image: string, index: number) => (
                    <Pressable
                      key={index}
                      onPress={() => openImageModal(index)}
                    >
                      <Image
                        source={{ uri: image }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
                
                {listing.images.length > 1 && (
                  <View style={styles.pagination}>
                    {listing.images.map((_: any, index: number) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,
                          index === currentImageIndex && styles.paginationDotActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
                
                {listing.images.length > 1 && (
                  <View style={styles.slideshowBadge}>
                    <Ionicons name="play-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.slideshowText}>Auto</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{listing.title}</Text>
                <View style={[styles.statusBadge, { 
                    backgroundColor: listing.food_type === 'veg' ? '#DCFCE7' : listing.food_type === 'non_veg' ? '#FEE2E2' : '#EFF6FF' 
                }]}>
                  <Text style={[styles.statusText, {
                      color: listing.food_type === 'veg' ? '#166534' : listing.food_type === 'non_veg' ? '#991B1B' : '#1E40AF'
                  }]}>
                      {listing.food_type === 'veg' ? 'VEG' : listing.food_type === 'non_veg' ? 'NON-VEG' : 'MIXED'}
                  </Text>
                </View>
              </View>

              {/* UPDATED: Quantity instead of Price */}
              <Text style={styles.price}>{listing.quantity_kg} kg available</Text>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color="#D97706" />
                <Text style={[styles.address, { color: '#B45309', fontWeight: '500' }]}>
                    {getExpiryDisplay(listing.expiry_time)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location" size={20} color="#6B7280" />
                <Text style={styles.address}>{listing.address}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>{listing.description}</Text>
              </View>

              {!isOwner && listing.owner_name && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Provided By</Text>
                  <View style={styles.ownerCard}>
                    <View style={styles.ownerAvatar}>
                      <Ionicons name="business" size={24} color="#007AFF" />
                    </View>
                    <View style={styles.ownerInfo}>
                      <Text style={styles.ownerName}>{listing.owner_name}</Text>
                      <Text style={styles.ownerPhone}>Hotel Partner</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {!isOwner ? (
            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.callButton,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={handleCall}
              >
                <Ionicons name="call" size={20} color="#FFFFFF" />
                <Text style={styles.callButtonText}>Call Hotel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.messageButton,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={handleMessage}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                <Text style={styles.messageButtonText}>Chat</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.editButton,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={onEdit}
              >
                <Ionicons name="create" size={20} color="#007AFF" />
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.deleteButton,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={handleDelete}
              >
                <Ionicons name="trash" size={20} color="#DC2626" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={imageModalVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.imageModalContainer}>
          <View style={styles.imageModalHeader}>
            <Text style={styles.imageModalCounter}>
              {modalImageIndex + 1} / {listing?.images?.length || 0}
            </Text>
            <Pressable onPress={closeImageModal} style={styles.imageModalClose}>
              <Ionicons name="close-circle" size={32} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imageModalScroll}
            contentContainerStyle={styles.imageModalScrollContent}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH
              );
              setModalImageIndex(index);
            }}
          >
            {listing?.images?.map((image: string, index: number) => (
              <View key={index} style={styles.imageModalSlide}>
                <Image
                  source={{ uri: image }}
                  style={styles.imageModalImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {listing?.images && listing.images.length > 1 && (
            <View style={styles.imageModalPagination}>
              {listing.images.map((_: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.imageModalDot,
                    index === modalImageIndex && styles.imageModalDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  saveButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#F3F4F6',
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
  slideshowBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  slideshowText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: '#059669', // Green for Quantity
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  address: {
    flex: 1,
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  ownerPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  callButton: {
    backgroundColor: '#10B981',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  messageButton: {
    backgroundColor: '#007AFF',
  },
  messageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  editButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageModalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imageModalCounter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imageModalClose: {
    padding: 4,
  },
  imageModalScroll: {
    flex: 1,
  },
  imageModalScrollContent: {
    alignItems: 'center',
  },
  imageModalSlide: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  imageModalPagination: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  imageModalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  imageModalDotActive: {
    backgroundColor: '#FFFFFF',
    width: 28,
  },
});