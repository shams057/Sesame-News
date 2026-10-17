import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

/**
 * Map each route name to [inactiveGlyph, activeGlyph].
 * Edit the keys to match the route names in your Tab.Navigator.
 */
const GLYPHS = {
  News:       ['🗞', '🗞'],
  Actualites: ['🗞', '🗞'],
  Home:       ['⌂', '⌂'],
  Accueil:    ['⌂', '⌂'],
  Courses:    ['📖', '📚'],
  Cours:      ['📖', '📚'],
  Schedule:   ['📅', '📅'],
  Planning:   ['📅', '📅'],
  Notes:      ['🎖', '🎖'],
  Grades:     ['🏅', '🏅'],
  Messages:   ['💬', '💬'],
  Profile:    ['👤', '👤'],
  Profil:     ['👤', '👤'],
  Settings:   ['⚙', '⚙'],
};
const glyphFor = (name) => GLYPHS[name] || ['●', '●'];

const BAR_H = 64;
const PAD = 6;

export default function GlassTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const count = state.routes.length;
  const barW = Math.min(width - 32, count * 78 + PAD * 2);
  const tabW = (barW - PAD * 2) / count;
  const lensH = BAR_H - PAD * 2;

  const position = useRef(new Animated.Value(state.index)).current; // glide
  const stretch = useRef(new Animated.Value(0)).current; // liquid stretch while moving
  const press = useRef(new Animated.Value(0)).current; // touch swell

  useEffect(() => {
    Animated.spring(position, {
      toValue: state.index,
      stiffness: 240,
      damping: 21,
      mass: 0.9,
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.timing(stretch, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.spring(stretch, {
        toValue: 0,
        stiffness: 200,
        damping: 12,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state.index, position, stretch]);

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  if (StyleSheet.flatten(focusedOptions.tabBarStyle)?.display === 'none') return null;

  const idx = [...Array(Math.max(count, 2)).keys()];
  const lensX = position.interpolate({
    inputRange: idx,
    outputRange: idx.map((i) => PAD + i * tabW),
  });
  const lensScaleX = Animated.multiply(
    stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] })
  );
  const lensScaleY = Animated.multiply(
    stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] })
  );

  const animatePress = (to) =>
    Animated.spring(press, {
      toValue: to,
      stiffness: 300,
      damping: 16,
      mass: 0.6,
      useNativeDriver: true,
    }).start();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={[styles.shadow, { width: barW, height: BAR_H }]}>
        <View style={styles.clip}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 70 : 50}
            tint="light"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  Platform.OS === 'ios'
                    ? 'rgba(255,255,255,0.42)'
                    : 'rgba(255,255,255,0.9)',
              },
            ]}
          />
          <View pointerEvents="none" style={styles.rim} />

          {/* Gliding glass lens */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lens,
              {
                width: tabW,
                height: lensH,
                borderRadius: lensH / 2,
                transform: [
                  { translateX: lensX },
                  { scaleX: lensScaleX },
                  { scaleY: lensScaleY },
                ],
              },
            ]}
          />

          <View style={styles.row}>
            {state.routes.map((route, i) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === i;
              const [glyphOff, glyphOn] = glyphFor(route.name);

              const range = { inputRange: [i - 1, i, i + 1], extrapolate: 'clamp' };
              const active = position.interpolate({ ...range, outputRange: [0, 1, 0] });
              const inactive = position.interpolate({ ...range, outputRange: [1, 0, 1] });
              const scale = position.interpolate({ ...range, outputRange: [1, 1.08, 1] });

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () =>
                navigation.emit({ type: 'tabLongPress', target: route.key });

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  onPressIn={() => isFocused && animatePress(1)}
                  onPressOut={() => animatePress(0)}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={
                    options.tabBarAccessibilityLabel || options.title || route.name
                  }
                  style={[styles.tab, { width: tabW }]}
                >
                  <Animated.View style={[styles.iconBox, { transform: [{ scale }] }]}>
                    <Animated.View style={[styles.iconLayer, { opacity: inactive }]}>
                      <Text style={styles.glyph}>{glyphOff}</Text>
                    </Animated.View>
                    <Animated.View style={[styles.iconLayer, { opacity: active }]}>
                      <Text style={styles.glyphActive}>{glyphOn}</Text>
                    </Animated.View>
                    {options.tabBarBadge != null ? <View style={styles.badge} /> : null}
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shadow: {
    borderRadius: BAR_H / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 22,
      },
      android: { elevation: 10, backgroundColor: '#FFFFFF' },
    }),
  },
  clip: {
    flex: 1,
    borderRadius: BAR_H / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_H / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  lens: {
    position: 'absolute',
    top: PAD,
    left: 0,
    backgroundColor: 'rgba(100,116,139,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: PAD,
    alignItems: 'center',
  },
  tab: {
    height: BAR_H - PAD * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: { width: 32, height: 32 },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 22, lineHeight: 28, color: '#64748B' },
  glyphActive: { fontSize: 22, lineHeight: 28 },
  badge: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});