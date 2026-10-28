import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function VideoPlayer({ uri }) {
  if (!uri) return null;
  return <VideoPlayerContent uri={uri} />;
}

function VideoPlayerContent({ uri }) {
  const player = useVideoPlayer(encodeURI(uri), (videoPlayer) => {
    videoPlayer.loop = false;
  });

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: true }}
        playsInline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});
