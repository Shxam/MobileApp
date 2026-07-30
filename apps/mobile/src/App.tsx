// ===================================================
// IPL Dhaba Mobile — React Native Main Entry App Component
// Native Navigation & Tab Router Component
// ===================================================

import React, { useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { HomeScreen } from './screens/HomeScreen';

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<'home' | 'turfs' | 'food' | 'celebrations'>('home');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      
      {/* App Header Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>IPL DHABA 🏏</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PROD</Text>
        </View>
      </View>

      {/* Screen Router */}
      <View style={styles.mainContainer}>
        {activeTab === 'home' && <HomeScreen onNavigate={(tab) => setActiveTab(tab as any)} />}
        {activeTab !== 'home' && (
          <View style={styles.placeholderScreen}>
            <Text style={styles.placeholderText}>Screen: {activeTab.toUpperCase()}</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => setActiveTab('home')}>
              <Text style={styles.backButtonText}>← Back to Home</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {(['home', 'turfs', 'food', 'celebrations'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, activeTab === tab && styles.navItemActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>
              {tab === 'home' ? '🏠 Home' : tab === 'turfs' ? '🏏 Turfs' : tab === 'food' ? '🍗 Food' : '🎉 Party'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    height: 56,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mainContainer: {
    flex: 1,
  },
  placeholderScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  bottomNav: {
    height: 60,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justify: 'center',
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#f59e0b',
  },
  navText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  navTextActive: {
    color: '#f8fafc',
  },
});
