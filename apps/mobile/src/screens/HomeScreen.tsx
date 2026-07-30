// ===================================================
// IPL Dhaba Mobile — Home Screen Component
// React Native / Expo Native UI Shell
// ===================================================

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';

export const HomeScreen: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Banner */}
      <View style={styles.bannerContainer}>
        <Text style={styles.badgeText}>🔥 MATCHDAY LIVE</Text>
        <Text style={styles.heroTitle}>IPL DHABA SUPER APP</Text>
        <Text style={styles.heroSubtitle}>Singarayakonda's #1 Floodlit Box Turf & Authentic Dhaba Kitchen</Text>
      </View>

      {/* Action Cards */}
      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={() => onNavigate('turfs')}>
          <Text style={styles.cardTitle}>🏏 Book Box Turf</Text>
          <Text style={styles.cardSub}>Floodlit 500 Lux Cage from ₹1,200/hr</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => onNavigate('food')}>
          <Text style={styles.cardTitle}>🍗 Order Dhaba Food</Text>
          <Text style={styles.cardSub}>70+ Hot Items delivered right to your bench</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => onNavigate('celebrations')}>
          <Text style={styles.cardTitle}>🎉 Party Celebrations</Text>
          <Text style={styles.cardSub}>Host T10 Birthdays with Live Commentary</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    padding: 16,
  },
  bannerContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  badgeText: {
    color: '#f59e0b',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    gap: 12,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSub: {
    color: '#64748b',
    fontSize: 13,
  },
});
