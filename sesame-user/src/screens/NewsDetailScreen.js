import React, { useEffect } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../api/client';
import { spacing, useColors } from '../theme';
import NewsCard from '../components/NewsCard';
import { ErrorState, Loading } from '../components/ui';

/** Full article (also the target of `sesame://actualites/:id` and notifications). */
export default function NewsDetailScreen({ route }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { id, news: preview } = route.params;
  const news = useQuery({
    queryKey: ['news', Number(id)],
    queryFn: () => api.get(`/feed/${id}`).then((r) => r.data),
    placeholderData: preview,
  });
  // The API marks the article as seen when it is fetched: refresh badges.
  const queryClient = useQueryClient();
  const loaded = Boolean(news.data && !news.isPlaceholderData);
  useEffect(() => {
    if (loaded) queryClient.invalidateQueries({ queryKey: ['unseen'] });
  }, [loaded, queryClient]);
  if (news.isPending) return <Loading />;
  if (news.isError && !news.data) {
    return <ErrorState message={news.error?.response?.status === 404 ? 'Cette actualité n’est plus disponible.' : errorMessage(news.error)} onRetry={news.refetch} />;
  }
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      <NewsCard news={news.data} full width={Math.min(width - 66, 726)} />
    </ScrollView>
  );
}
