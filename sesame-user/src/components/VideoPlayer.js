import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Dimensions,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function VideoPlayer({ uri }) {
  if (!uri) return null;
  return <VideoPlayerContent uri={uri} />;
}

function VideoPlayerContent({ uri }) {
  const [fullscreen, setFullscreen] = useState(false);

  const encoded = encodeURI(uri);

  const player = useVideoPlayer(encoded, (p) => {
    p.loop = true;
  });

  const fullPlayer = useVideoPlayer(encoded, (p) => {
    p.loop = true;
  });

  const togglePlay = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity activeOpacity={0.95} onPress={togglePlay}>
        <VideoView
          player={player}
          style={styles.video}
           contentFit="contain"
           nativeControls
        />
        {!player.playing && (
          <View style={styles.overlay}>
            <View style={styles.playBtn}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fsBtn}
        onPress={() => {
          fullPlayer.play();
          setFullscreen(true);
        }}
      >
        <Text style={styles.fsText}>⛶  Plein écran</Text>
      </TouchableOpacity>

      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={() => {
          fullPlayer.pause();
          setFullscreen(false);
        }}
      >
        <View style={styles.fullContainer}>
          <VideoView
            player={fullPlayer}
            style={styles.fullVideo}
            contentFit="contain"
            nativeControls
            fullscreenOptions={{ enable: true }}
          />
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              fullPlayer.pause();
              setFullscreen(false);
            }}
          >
            <Text style={styles.closeText}>✕ Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 360,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(26,63,196,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: 22,
    marginLeft: 3,
  },
  fsBtn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  fsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  fullContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullVideo: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    zIndex: 10,
  },
  closeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
