import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import NewsScreen from './src/screens/NewsScreen';
import ChatScreen from './src/screens/ChatScreen';
import { colors, LOGO_URL } from './src/theme/colors';

const Stack = createNativeStackNavigator();

/* ─── Mobile View Navigator (Android / iOS / Mobile Web) ────────────────── */
function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState('news');
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Active Screen */}
      <View style={{ flex: 1 }}>
        {activeTab === 'news' ? <NewsScreen /> : <ChatScreen />}
      </View>

      {/* Mobile Bottom Navigation Bar */}
      <View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'news' && styles.tabItemActive]}
            onPress={() => setActiveTab('news')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabIcon, activeTab === 'news' && styles.tabIconActive]}>
              📰
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'news' && styles.tabLabelActive]}>
              Actualités
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'chat' && styles.tabItemActive]}
            onPress={() => setActiveTab('chat')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabIcon, activeTab === 'chat' && styles.tabIconActive]}>
              🤖
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'chat' && styles.tabLabelActive]}>
              Assistant IA
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ─── Desktop Web View Layout (Computers & Large Screens) ──────────────── */
function DesktopWebLayout() {
  const [activeTab, setActiveTab] = useState('news'); // 'news' | 'chat' | 'split'
  const { user, logout } = useAuth();

  return (
    <View style={styles.desktopWrapper}>
      {/* Top Navbar Header */}
      <header style={styles.desktopHeader}>
        <View style={styles.desktopNavInner}>
          {/* Brand Logo & Title */}
          <View style={styles.desktopBrandRow}>
            <Image source={{ uri: LOGO_URL }} style={styles.desktopLogo} />
            <View>
              <Text style={styles.desktopBrandTitle}>Université SESAME</Text>
              <Text style={styles.desktopBrandSub}>Espace Étudiant Web</Text>
            </View>
          </View>

          {/* Nav Tabs */}
          <View style={styles.desktopNavTabs}>
            <TouchableOpacity
              style={[styles.desktopTabBtn, activeTab === 'news' && styles.desktopTabBtnActive]}
              onPress={() => setActiveTab('news')}
            >
              <Text style={[styles.desktopTabText, activeTab === 'news' && styles.desktopTabTextActive]}>
                📰 Actualités & Fil
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.desktopTabBtn, activeTab === 'chat' && styles.desktopTabBtnActive]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={[styles.desktopTabText, activeTab === 'chat' && styles.desktopTabTextActive]}>
                🤖 Assistant IA (RAG)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.desktopTabBtn, activeTab === 'split' && styles.desktopTabBtnActive]}
              onPress={() => setActiveTab('split')}
            >
              <Text style={[styles.desktopTabText, activeTab === 'split' && styles.desktopTabTextActive]}>
                🖥️ Vue Duale
              </Text>
            </TouchableOpacity>
          </View>

          {/* User Profile & Logout */}
          <View style={styles.desktopUserRow}>
            <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
              <Text style={styles.desktopUserName}>
                {user?.firstname} {user?.lastname}
              </Text>
              <Text style={styles.desktopUserTag}>Étudiant Connecté</Text>
            </View>
            <TouchableOpacity onPress={logout} style={styles.desktopLogoutBtn}>
              <Text style={styles.desktopLogoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>
      </header>

      {/* Main Content Body */}
      <View style={styles.desktopMainBody}>
        {activeTab === 'news' && (
          <View style={styles.desktopSingleCard}>
            <NewsScreen />
          </View>
        )}

        {activeTab === 'chat' && (
          <View style={styles.desktopSingleCard}>
            <ChatScreen />
          </View>
        )}

        {activeTab === 'split' && (
          <View style={styles.desktopSplitGrid}>
            <View style={styles.desktopLeftCol}>
              <NewsScreen />
            </View>
            <View style={styles.desktopRightCol}>
              <ChatScreen />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── Root Navigator ────────────────────────────────────────────────────── */
function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { width } = useWindowDimensions();

  // Desktop check: Only on Web browsers with screen width >= 768px
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  // If authenticated: desktop layout on PC browsers, mobile layout on phones & native app
  return isDesktopWeb ? <DesktopWebLayout /> : <MainTabNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Mobile Bottom Bar
  bottomBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  tabItemActive: {
    backgroundColor: '#EFF6FF',
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSoft,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Desktop Web Styles
  desktopWrapper: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    minHeight: '100vh',
  },
  desktopHeader: {
    backgroundColor: colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  desktopNavInner: {
    maxWidth: 1400,
    marginHorizontal: 'auto',
    paddingHorizontal: 24,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  desktopBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  desktopLogo: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  desktopBrandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  desktopBrandSub: {
    color: colors.secondary,
    fontSize: 11,
  },
  desktopNavTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  desktopTabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  desktopTabBtnActive: {
    backgroundColor: colors.primary,
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  desktopTabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13.5,
    fontWeight: '600',
  },
  desktopTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  desktopUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopUserName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  desktopUserTag: {
    color: '#94A3B8',
    fontSize: 11,
  },
  desktopLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  desktopLogoutText: {
    color: '#FCA5A5',
    fontSize: 12.5,
    fontWeight: '600',
  },

  desktopMainBody: {
    flex: 1,
    maxWidth: 1400,
    width: '100%',
    marginHorizontal: 'auto',
    padding: 24,
  },
  desktopSingleCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
    maxWidth: 900,
    marginHorizontal: 'auto',
    width: '100%',
    minHeight: 700,
  },
  desktopSplitGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 24,
    minHeight: 720,
  },
  desktopLeftCol: {
    flex: 1.2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  },
  desktopRightCol: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  },
});