import React, { useEffect } from 'react';
import { Platform, Pressable, useWindowDimensions } from 'react-native';
import { createNavigationContainerRef, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useColors } from '../theme';
import { registerForPushNotifications, targetFromNotification } from '../notifications/push';
import { Loading } from '../components/ui';
import LoginScreen from '../screens/LoginScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import FeedScreen from '../screens/FeedScreen';
import NewsDetailScreen from '../screens/NewsDetailScreen';
import EventsScreen from '../screens/EventsScreen';
import TicketsScreen from '../screens/TicketsScreen';
import TicketDetailScreen from '../screens/TicketDetailScreen';
import NewTicketScreen from '../screens/NewTicketScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AssistantScreen from '../screens/AssistantScreen';

export const navigationRef = createNavigationContainerRef();
const Root = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const FeedStack = createNativeStackNavigator();
const EventsStack = createNativeStackNavigator();
const TicketsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function useStackOptions() {
  const colors = useColors();
  return {
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text, fontWeight: '700' },
    contentStyle: { backgroundColor: colors.bg },
    headerBackButtonDisplayMode: 'minimal',
  };
}

function FeedNavigator() {
  return (
    <FeedStack.Navigator screenOptions={useStackOptions()}>
      <FeedStack.Screen name="Feed" component={FeedScreen} options={{ title: 'Actualités' }} />
      <FeedStack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ title: 'Actualité' }} />
    </FeedStack.Navigator>
  );
}

function EventsNavigator() {
  return (
    <EventsStack.Navigator screenOptions={useStackOptions()}>
      <EventsStack.Screen name="Events" component={EventsScreen} options={{ title: 'Agenda' }} />
      <EventsStack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ title: 'Événement' }} />
    </EventsStack.Navigator>
  );
}

function TicketsNavigator() {
  return (
    <TicketsStack.Navigator screenOptions={useStackOptions()}>
      <TicketsStack.Screen name="Tickets" component={TicketsScreen} options={{ title: 'Mes demandes' }} />
      <TicketsStack.Screen name="NewTicket" component={NewTicketScreen} options={{ title: 'Nouvelle demande' }} />
      <TicketsStack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'Demande' }} />
    </TicketsStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={useStackOptions()}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Mot de passe' }} />
    </ProfileStack.Navigator>
  );
}

const TAB_ICONS = {
  FeedTab: ['newspaper', 'newspaper-outline'],
  EventsTab: ['calendar', 'calendar-outline'],
  TicketsTab: ['chatbubbles', 'chatbubbles-outline'],
  ProfileTab: ['person-circle', 'person-circle-outline'],
};

function MainTabs() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const side = Platform.OS === 'web' && width >= 900;
  const unread = useQuery({ queryKey: ['unread'], queryFn: () => api.get('/tickets/unread').then((r) => r.data), refetchInterval: 60000 });
  const unseen = useQuery({ queryKey: ['unseen'], queryFn: () => api.get('/feed/unseen-count').then((r) => r.data), refetchInterval: 120000 });
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarPosition: side ? 'left' : 'bottom',
        tabBarVariant: side ? 'material' : 'uikit',
        tabBarLabelPosition: side ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderColor: colors.border, ...(side ? { width: 220 } : {}) },
        tabBarLabelStyle: { fontSize: side ? 14 : 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />,
      })}
    >
      <Tabs.Screen
        name="FeedTab"
        component={FeedNavigator}
        options={{
          title: 'Actualités',
          tabBarBadge: unseen.data?.count || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary },
          tabBarAccessibilityLabel: unseen.data?.count ? `Actualités, ${unseen.data.count} non lues` : 'Actualités',
        }}
      />
      <Tabs.Screen name="EventsTab" component={EventsNavigator} options={{ title: 'Agenda' }} />
      <Tabs.Screen
        name="TicketsTab"
        component={TicketsNavigator}
        options={{
          title: 'Demandes',
          tabBarBadge: unread.data?.count || undefined,
          tabBarAccessibilityLabel: unread.data?.count ? `Demandes, ${unread.data.count} non lues` : 'Demandes',
        }}
      />
      <Tabs.Screen name="ProfileTab" component={ProfileNavigator} options={{ title: 'Profil' }} />
    </Tabs.Navigator>
  );
}

const linking = {
  prefixes: [Linking.createURL('/'), 'sesame://'],
  config: {
    screens: {
      Main: {
        screens: {
          FeedTab: { screens: { Feed: 'actualites', NewsDetail: 'actualites/:id' } },
          EventsTab: { screens: { Events: 'agenda' } },
          TicketsTab: { screens: { Tickets: 'demandes', NewTicket: 'demandes/nouvelle', TicketDetail: 'demandes/:id' } },
          ProfileTab: { screens: { Profile: 'profil' } },
        },
      },
      Assistant: 'assistant',
    },
  },
};

function navigateTo(target) {
  if (target && navigationRef.isReady()) navigationRef.navigate('Main', { screen: target.tab, params: { screen: target.screen, params: target.params } });
}

export default function RootNavigator() {
  const { status, account } = useAuth();
  const colors = useColors();
  const stackOptions = useStackOptions();
  const ready = status === 'authenticated' && account && !account.mustChangePassword;

  // Push: register once signed in; route notification taps to their screen.
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return undefined;
    registerForPushNotifications().catch(() => {});
    Notifications.getLastNotificationResponseAsync().then((response) => navigateTo(targetFromNotification(response))).catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => navigateTo(targetFromNotification(response)));
    return () => subscription.remove();
  }, [ready]);

  const theme = DefaultTheme;
  const navTheme = { ...theme, colors: { ...theme.colors, primary: colors.primary, background: colors.bg, card: colors.card, text: colors.text, border: colors.border } };

  if (status === 'checking') return <Loading />;

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme} documentTitle={{ formatter: (options) => (options?.title ? `${options.title} · Sesame News` : 'Sesame News') }}>
      <Root.Navigator screenOptions={stackOptions}>
        {status !== 'authenticated' ? (
          <Root.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : account?.mustChangePassword ? (
          <Root.Screen name="ForcedPassword" component={ChangePasswordScreen} options={{ title: 'Choisissez votre mot de passe', headerBackVisible: false }} initialParams={{ forced: true }} />
        ) : (
          <>
            <Root.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Root.Screen
              name="Assistant"
              component={AssistantScreen}
              options={({ navigation }) => ({
                title: 'Assistant SESAME',
                presentation: 'modal',
                headerLeft: () => (
                  <Pressable accessibilityRole="button" accessibilityLabel="Fermer l’assistant" hitSlop={10} style={{ padding: 6 }}
                    onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}>
                    <Ionicons name="close" size={24} color={colors.primary} />
                  </Pressable>
                ),
              })}
            />
          </>
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
