import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated, Dimensions, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import LinearGradient from 'react-native-linear-gradient';
import BASE_URL from '../../config/api';
import tw from 'twrnc';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  primary: '#FF6B35',
  primaryDark: '#FF512F',
  secondary: '#FF8C42',
  bgWhite: '#FFFFFF',
  bgLight: '#F8F9FA',
  textDark: '#333333',
  textGray: '#666666',
  textLight: '#999999',
  border: '#E0E0E0',
  shadow: '#000000',
  online: '#4ade80',
  cardBg: '#FFFFFF',
};

const ProfileScreen = ({ navigation }: any) => {
  const [user, setUser] = useState<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, 1], extrapolate: 'clamp' });

  useFocusEffect(useCallback(() => { fetchProfile(); }, []));

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await axios.get(`${BASE_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
      setUser(res.data.user);
    } catch { }
  };

  const calculateAge = (fullDate: any) => {
    if (!fullDate) return null;
    return Math.floor((Date.now() - new Date(fullDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  if (!user) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );

  const primaryPhoto = user.profilePhotos?.find((p: any) => p.isPrimary) || user.profilePhotos?.[0];
  const age = calculateAge(user.dateOfBirth?.fullDate);
  const tier = user.subscription?.effectiveTier || user.accountType || 'normal';
  const isPremium = tier === 'gold' || tier === 'platinum';

  // Get 3-4 interesting tags from the new nested fields
  const getProfileTags = () => {
    const tags = [];
    if (user.lifestyle?.diet && user.lifestyle.diet !== "") tags.push({ label: user.lifestyle.diet, icon: 'restaurant' });
    if (user.personality?.personalityType && user.personality.personalityType !== "") tags.push({ label: user.personality.personalityType, icon: 'psychology' });
    if (user.beliefs?.religion && user.beliefs.religion !== "") tags.push({ label: user.beliefs.religion, icon: 'public' });
    if (user.lifestyle?.drinking && user.lifestyle.drinking !== "") tags.push({ label: user.lifestyle.drinking, icon: 'local-bar' });
    return tags.slice(0, 3);
  };

  const profileTags = getProfileTags();

  const handleRestoreAccount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(`${BASE_URL}/profile/cancel-deletion`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        fetchProfile();
      }
    } catch (error) {
      console.error('Failed to restore account', error);
    }
  };

  const getRemainingTime = (requestedAt: string) => {
    const fortyEightHours = 48 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(requestedAt).getTime();
    const remaining = fortyEightHours - elapsed;

    if (remaining <= 0) return "Account being processed for deletion";

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return `Permanent deletion in ${hours}h ${minutes}m`;
  };

  return (
    <View style={styles.container}>
      {/* Deletion Warning Banner */}
      {user.deletionRequestedAt && (
        <View style={styles.deletionBanner}>
          <View style={styles.deletionBannerLeft}>
            <Icon name="warning" size={20} color="#FFF" />
            <Text style={styles.deletionBannerText}>
              Your account is in deletion period.{'\n'}
              {getRemainingTime(user.deletionRequestedAt)}
            </Text>
          </View>
          <TouchableOpacity style={styles.restoreButton} onPress={handleRestoreAccount}>
            <Text style={styles.restoreButtonText}>Cancel Now {'->'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <LinearGradient colors={[C.bgWhite, C.bgLight]} style={styles.headerGradient}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>{user.name}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={styles.headerIcon}>
            <Icon name="edit" size={20} color={C.primary} />
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroImageContainer}>
            <Image source={{ uri: primaryPhoto?.url || 'https://via.placeholder.com/400' }} style={styles.heroImage} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']} style={styles.imageGradient} />

            <View style={styles.heroInfoContent}>
              <View style={styles.nameRow}>
                <Text style={styles.heroName}>{user.name}, {age || ''}</Text>
                {isPremium && <Icon name="verified" size={22} color={C.primary} style={{ marginLeft: 6 }} />}
              </View>
              {isPremium && (
                <View style={styles.premiumBadgeRow}>
                  <Icon name="stars" size={14} color="#FFD700" />
                  <Text style={styles.premiumBadgeText}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)} Membership • {user.subscription?.subscriptionDaysRemaining || 0} days left
                  </Text>
                </View>
              )}
              <Text style={styles.heroSubText}><Icon name="location-on" size={12} /> {user.city || user.state || 'India'}</Text>
              <Text style={styles.heroEmail}><Icon name="email" size={12} /> {user.email || ''}</Text>
            </View>


            <TouchableOpacity
              style={styles.editFab}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <LinearGradient colors={[C.primary, C.primaryDark]} style={styles.editFabGradient}>
                <Icon name="edit" size={24} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {/* Quick Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{user.stats?.totalLikes || 0}</Text>
              <Text style={styles.statLab}>Likes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{user.stats?.totalMatches || 0}</Text>
              <Text style={styles.statLab}>Matches</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{user.stats?.profileViews || 0}</Text>
              <Text style={styles.statLab}>Views</Text>
            </View>
          </View>

          {/* Upgrade Card - Elite Luxury Black & Gold Theme */}
          {!isPremium && (
            <TouchableOpacity
              style={styles.premiumCard}
              onPress={() => navigation.navigate('Premium')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#111827', '#1F2937', '#111827']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumGradient}
              >
                <View style={[styles.premiumContent, tw`relative`]}>
                   {/* Gold Shimmer Background Icon */}
                  <View style={[tw`absolute -right-6 -bottom-6 opacity-10`]}>
                     <Icon name="auto_awesome" size={140} color="#FFD700" />
                  </View>

                  <View style={tw`flex-1`}>
                    <View style={tw`flex-row items-center mb-2`}>
                      <View style={[tw`p-1.5 rounded-lg mr-2`, { backgroundColor: '#FFD700' + '20' }]}>
                        <Icon name="stars" size={26} color="#FFD700" />
                      </View>
                      <Text style={tw`text-white font-black text-xl tracking-tight`}>DailyDate <Text style={{ color: '#FFD700' }}>Gold</Text></Text>
                    </View>
                    <Text style={tw`text-gray-400 text-[13px] font-bold leading-5`}>
                      Unlock 50 Likes/day, Direct Messaging, and more elite features.
                    </Text>
                    
                    <TouchableOpacity 
                      onPress={() => navigation.navigate('Premium')}
                      style={[tw`mt-5 self-start px-6 py-2.5 rounded-full shadow-lg`, { backgroundColor: '#FFD700' }]}
                    >
                       <Text style={tw`text-black text-[12px] font-black uppercase tracking-wider`}>Upgrade Now</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={tw`ml-4 items-center justify-center`}>
                     <View style={[tw`w-20 h-20 rounded-full bg-white/5 items-center justify-center border border-white/10`]}>
                        <Icon name="diamond" size={42} color="#FFD700" />
                     </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* About Me Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <Text style={styles.bioText}>{user.bio || '✨ No bio yet. Tap edit to express yourself!'}</Text>

            {profileTags.length > 0 && (
              <View style={styles.tagContainer}>
                {profileTags.map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <Icon name={tag.icon} size={14} color={C.primary} />
                    <Text style={styles.tagText}>{tag.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Essential Info */}
          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Icon name="favorite" size={20} color={C.primary} />
              <Text style={styles.infoCardLabel}>Looking for</Text>
              <Text style={styles.infoCardValue}>{user.lookingFor ? user.lookingFor.charAt(0).toUpperCase() + user.lookingFor.slice(1) : 'Everyone'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Icon name="search" size={20} color={C.primary} />
              <Text style={styles.infoCardLabel}>Intention</Text>
              <Text style={styles.infoCardValue}>{user.intention || 'Casual'}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionList}>
            {[
              { icon: 'favorite', label: 'My Likes', color: '#E91E63', onPress: () => navigation.navigate('MyLikes') },
              { icon: 'notifications', label: 'Notifications', color: C.primary, onPress: () => navigation.navigate('Notifications') },
              { icon: 'block', label: 'Blocked Users', color: '#F44336', onPress: () => navigation.navigate('BlockedUsers') },
              ...(isPremium ? [{ icon: 'workspace-premium', label: 'Manage Subscription', color: '#FFD700', onPress: () => navigation.navigate('Premium') }] : []),
              { icon: 'settings', label: 'Account Settings', color: C.textGray, onPress: () => navigation.navigate('ManageAccount') },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={styles.actionItem} onPress={item.onPress}>
                <View style={[styles.actionIcon, { backgroundColor: item.color + '15' }]}>
                  <Icon name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.actionLabel}>{item.label}</Text>
                <Icon name="chevron-right" size={20} color={C.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgWhite },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  animatedHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, backgroundColor: C.bgWhite, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.textDark },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgLight, alignItems: 'center', justifyContent: 'center' },
  heroSection: { height: H * 0.5 },
  heroImageContainer: { position: 'relative', width: '100%', height: '100%' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  heroInfoContent: { position: 'absolute', bottom: 30, left: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  heroName: { fontSize: 32, fontWeight: '900', color: '#FFF' },
  premiumBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  heroSubText: { fontSize: 14, color: '#DDD', marginTop: 6, fontWeight: '600' },
  heroEmail: { fontSize: 13, color: '#EEE', marginTop: 4, fontWeight: '500' },
  notificationFab: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  notifFabGradient: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  editFab: { position: 'absolute', bottom: -25, right: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  editFabGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 40 },
  statsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30, backgroundColor: C.bgLight, borderRadius: 24, paddingVertical: 16 },
  statItem: { alignItems: 'center', paddingHorizontal: 30 },
  statDivider: { width: 1, height: 30, backgroundColor: C.border },
  statVal: { fontSize: 20, fontWeight: '900', color: C.primary },
  statLab: { fontSize: 12, color: C.textGray, fontWeight: '600', marginTop: 2 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: C.textDark, marginBottom: 12 },
  bioText: { fontSize: 16, lineHeight: 24, color: C.textGray, fontWeight: '500' },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: '#FFE0D0' },
  tagText: { fontSize: 13, color: C.primary, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  infoCard: { flex: 1, backgroundColor: C.bgWhite, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 20, alignItems: 'center' },
  infoCardLabel: { fontSize: 12, color: C.textLight, fontWeight: '600', marginTop: 8, marginBottom: 2 },
  infoCardValue: { fontSize: 15, fontWeight: '800', color: C.textDark },
  actionList: { gap: 12, marginBottom: 20 },
  actionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, backgroundColor: C.bgWhite, borderWidth: 1, borderColor: C.border },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  actionLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: C.textDark },

  premiumCard: {
    marginHorizontal: 4,
    marginBottom: 30,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  premiumGradient: {
    padding: 24,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  premiumIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  premiumTextContainer: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.primary,
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    lineHeight: 18,
  },
  premiumArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletionBanner: {
    backgroundColor: '#D63031',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 50, // For notch
  },
  deletionBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deletionBannerText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  restoreButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  restoreButtonText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 11,
  },
});

export default ProfileScreen;