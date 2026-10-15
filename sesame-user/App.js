import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import NewsScreen from './src/screens/NewsScreen';
import ChatScreen from './src/screens/ChatScreen';
import TicketsScreen from './src/screens/TicketsScreen';
import { colors, LOGO_URL } from './src/theme/colors';

const Stack = createNativeStackNavigator();

function NavigationIcon({ name, active }) {
  const glyph = name === 'news' ? '▤' : name === 'tickets' ? '▣' : '◌';
  return <Text style={[styles.navIcon, active && styles.navIconActive]}>{glyph}</Text>;
}

function ChatPopup({ visible, onClose, desktop }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.chatOverlay, desktop && styles.chatOverlayDesktop]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer le chat" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.chatPopup, desktop && styles.chatPopupDesktop]}>
          <ChatScreen compact onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function UserAppLayout({ desktop }) {
  const [activeTab, setActiveTab] = useState('news');
  const [chatVisible, setChatVisible] = useState(false);
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const activeTitle = activeTab === 'news' ? 'Actualités' : 'Mes tickets';
  const currentScreen = activeTab === 'news'
    ? <NewsScreen showHeader={false} />
    : <TicketsScreen />;

  return (
    <View style={styles.appRoot}>
      {desktop ? (
        <View style={styles.desktopLayout}>
          <View style={styles.desktopSideNav}>
            <Image source={{ uri: LOGO_URL }} style={styles.desktopLogo} />
            <Text style={styles.sideTitle}>SESAME</Text>
            {['news', 'tickets'].map((tab) => (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.sideItem, activeTab === tab && styles.sideItemActive]}>
                <NavigationIcon name={tab} active={activeTab === tab} />
                <Text style={styles.sideItemText}>{tab === 'news' ? 'Actualités' : 'Mes tickets'}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.sideUser}>
              <Text numberOfLines={1} style={styles.sideUserName}>{user?.firstname} {user?.lastname}</Text>
              <TouchableOpacity onPress={logout} style={styles.sideLogout}><Text style={styles.sideItemText}>Déconnexion</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.desktopContent}>{currentScreen}</View>
        </View>
      ) : (
        <View style={styles.mobileLayout}>
          <View style={[styles.mobileHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <Image source={{ uri: LOGO_URL }} style={styles.mobileLogo} />
            <View style={styles.mobileHeaderCopy}>
              <Text style={styles.mobileHeaderTitle}>{activeTitle}</Text>
              <Text style={styles.mobileHeaderSub}>{user?.firstname} {user?.lastname}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={logout} style={styles.mobileLogout}>
              <Text style={styles.mobileLogoutText}>Quitter</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mobileContent}>{currentScreen}</View>
          <View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom, 6) }]}>
            <View style={styles.bottomBar}>
              {['news', 'tickets'].map((tab) => (
                <TouchableOpacity key={tab} accessibilityRole="button" accessibilityState={{ selected: activeTab === tab }} style={[styles.tabItem, activeTab === tab && styles.tabItemActive]} onPress={() => setActiveTab(tab)}>
                  <NavigationIcon name={tab} active={activeTab === tab} />
                  <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab === 'news' ? 'Actualités' : 'Tickets'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Ouvrir l’assistant IA"
        onPress={() => setChatVisible(true)}
        activeOpacity={0.85}
        style={[styles.chatFab, !desktop && { bottom: 82 + Math.max(insets.bottom, 6) }]}
      >
        <Text style={styles.chatFabGlyph}>＋</Text>
      </TouchableOpacity>
      <ChatPopup visible={chatVisible} onClose={() => setChatVisible(false)} desktop={desktop} />
    </View>
  );
}

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!isAuthenticated) {
    return <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="Login" component={LoginScreen} /></Stack.Navigator>;
  }
  return <UserAppLayout desktop={desktop} />;
}

export default function App() {
  return <SafeAreaProvider><AuthProvider><NavigationContainer><RootNavigator /></NavigationContainer></AuthProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  desktopLayout: { flex: 1, flexDirection: 'row', backgroundColor: '#F1F5F9' },
  desktopSideNav: { width: 220, flexShrink: 0, backgroundColor: colors.primaryDark, padding: 22, zIndex: 2 },
  desktopLogo: { width: 48, height: 48, resizeMode: 'contain', tintColor: '#fff', marginBottom: 12 },
  sideTitle: { color: '#fff', fontWeight: '800', fontSize: 18, marginBottom: 20 },
  sideItem: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 9, marginBottom: 6 },
  sideItemActive: { backgroundColor: colors.primary },
  sideItemText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sideUser: { marginTop: 'auto', paddingTop: 20 },
  sideUserName: { color: '#dbeafe', fontSize: 12, marginBottom: 8 },
  sideLogout: { paddingVertical: 12 },
  desktopContent: { flex: 1, minWidth: 0, minHeight: '100vh' },
  mobileLayout: { flex: 1, backgroundColor: colors.bg },
  mobileHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.primaryDark },
  mobileLogo: { width: 38, height: 38, resizeMode: 'contain', tintColor: '#fff' },
  mobileHeaderCopy: { flex: 1 },
  mobileHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  mobileHeaderSub: { color: colors.secondary, fontSize: 11, marginTop: 2 },
  mobileLogout: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.12)' },
  mobileLogoutText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mobileContent: { flex: 1, minHeight: 0 },
  bottomBarWrapper: { backgroundColor: 'rgba(255,255,255,0.88)', borderTopWidth: 1, borderTopColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  bottomBar: { height: 58, flexDirection: 'row', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'space-around' },
  tabItem: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, marginHorizontal: 6 },
  tabItemActive: { backgroundColor: '#EFF6FF' },
  navIcon: { fontSize: 19, color: '#64748B', fontWeight: '700' },
  navIconActive: { color: colors.primary },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 1 },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
  chatFab: { position: 'absolute', right: 20, bottom: 22, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.23, shadowRadius: 7, zIndex: 5 },
  chatFabGlyph: { color: '#fff', fontSize: 31, lineHeight: 36, fontWeight: '400' },
  chatOverlay: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 12, backgroundColor: 'rgba(15,23,42,0.34)' },
  chatOverlayDesktop: { alignItems: 'flex-end', justifyContent: 'flex-end', padding: 24 },
  chatPopup: { width: '100%', height: '76%', maxHeight: 650, maxWidth: 460, overflow: 'hidden', borderRadius: 18, backgroundColor: '#fff', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 18 },
  chatPopupDesktop: { height: 620 },
});
