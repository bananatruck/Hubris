import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    TextInput,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../src/theme';
import { useActivities } from '../../src/hooks/useActivities';
import { useCategoryStats } from '../../src/hooks/useStats';
import { entertainmentService, EntertainmentItem } from '../../src/services/entertainment';
import { createSearchController, EMPTY_SEARCH, type SearchState } from '../../src/services/search-controller';

type SubCategory = 'movie' | 'tv' | 'anime' | 'manga' | 'book';

function searchCategory(category: SubCategory, query: string): Promise<EntertainmentItem[]> {
    switch (category) {
        case 'movie': return entertainmentService.searchMovies(query);
        case 'tv': return entertainmentService.searchTV(query);
        case 'anime': return entertainmentService.searchAnime(query);
        case 'manga': return entertainmentService.searchManga(query);
        case 'book': return entertainmentService.searchBooks(query);
    }
}

const SUB_CATEGORIES: { id: SubCategory; label: string; icon: string }[] = [
    { id: 'movie', label: 'Movies', icon: '🎬' },
    { id: 'tv', label: 'TV', icon: '📺' },
    { id: 'anime', label: 'Anime', icon: '⛩️' },
    { id: 'manga', label: 'Manga', icon: '📖' },
    { id: 'book', label: 'Books', icon: '📚' },
];

export default function EntertainmentScreen() {
    const { activities, loading: activitiesLoading } = useActivities('entertainment');
    const { score: categoryScore } = useCategoryStats('entertainment');

    const [activeTab, setActiveTab] = useState<SubCategory>('movie');
    const [searchQuery, setSearchQuery] = useState('');
    const [search, setSearch] = useState<SearchState<EntertainmentItem>>(EMPTY_SEARCH);
    // Only the latest search owns the results: see createSearchController.
    const [controller] = useState(() => createSearchController(searchCategory, setSearch));
    useEffect(() => () => controller.dispose(), [controller]);

    // Filter activities by sub-category
    const filteredActivities = activities.filter(a => a.sub_category === activeTab);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Entertainment 🍿</Text>
                    <Text style={styles.subtitle}>Track what you watch & read</Text>
                </View>
                <View style={styles.scoreBox}>
                    <Text style={styles.scoreValue}>{categoryScore}</Text>
                    <Text style={styles.scoreLabel}>Score</Text>
                </View>
            </View>

            {/* Sub-category Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsContainer}
                contentContainerStyle={styles.tabsContent}
            >
                {SUB_CATEGORIES.map((tab) => (
                    <Pressable
                        key={tab.id}
                        style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                        onPress={() => {
                            setActiveTab(tab.id);
                            setSearchQuery('');
                            controller.reset();
                        }}
                    >
                        <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                            {tab.icon} {tab.label}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Search Section */}
                <View style={styles.searchSection}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder={`Search ${SUB_CATEGORIES.find(t => t.id === activeTab)?.label}...`}
                        placeholderTextColor={colors.text.tertiary}
                        value={searchQuery}
                        onChangeText={(text) => {
                            setSearchQuery(text);
                            controller.type(activeTab, text);
                        }}
                    />
                    {search.searching && (
                        <ActivityIndicator style={styles.searchLoader} color={colors.primary.main} />
                    )}
                </View>

                {search.error && (
                    <Text style={styles.searchError} accessibilityRole="alert">
                        {search.error}
                    </Text>
                )}

                {/* Search Results */}
                {search.results.length > 0 && (
                    <View style={styles.resultsList}>
                        <Text style={styles.sectionTitle}>Search Results</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resultsScroll}>
                            {search.results.map((item) => (
                                <Pressable
                                    key={item.id}
                                    style={styles.resultCard}
                                    onPress={() => {
                                        router.push({
                                            pathname: '/modals/activity-form',
                                            params: {
                                                name: item.title,
                                                category: 'entertainment',
                                                subCategory: item.type,
                                                externalId: item.externalId,
                                                imageUrl: item.imageUrl,
                                                color: '#EC4899', // Default pink for entertainment
                                            }
                                        });
                                    }}
                                >
                                    <Image
                                        source={{ uri: item.imageUrl || 'https://via.placeholder.com/100x150' }}
                                        style={styles.resultImage}
                                    />
                                    <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                                    {item.year && <Text style={styles.resultYear}>{item.year}</Text>}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Active Activities */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Library</Text>
                    {activitiesLoading ? (
                        <ActivityIndicator color={colors.primary.main} />
                    ) : filteredActivities.length > 0 ? (
                        <View style={styles.activityList}>
                            {filteredActivities.map((activity) => (
                                <Pressable key={activity.id} style={styles.activityCard}>
                                    <View style={styles.activityContent}>
                                        {activity.image_url ? (
                                            <Image source={{ uri: activity.image_url }} style={styles.activityPoster} />
                                        ) : (
                                            <View style={[styles.placeholderPoster, { backgroundColor: activity.color }]}>
                                                <Text style={styles.placeholderText}>{activity.name[0]}</Text>
                                            </View>
                                        )}
                                        <View style={styles.activityInfo}>
                                            <Text style={styles.activityName}>{activity.name}</Text>
                                            <Text style={styles.activityStats}>
                                                {activity.frequency_target}x {activity.frequency_rate}
                                            </Text>
                                            {/* Progress bar would go here */}
                                        </View>
                                        <Pressable
                                            style={styles.logButton}
                                            onPress={() => router.push(`/modals/quick-log?activityId=${activity.id}`)}
                                        >
                                            <Text style={styles.logButtonText}>Log</Text>
                                        </Pressable>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No {activeTab}s in your library yet.</Text>
                            <Text style={styles.emptySubText}>Search above to add one!</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    scoreBox: {
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
    },
    scoreValue: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.primary.main,
    },
    scoreLabel: {
        fontSize: 10,
        color: colors.text.tertiary,
        textTransform: 'uppercase',
    },
    tabsContainer: {
        maxHeight: 50,
        marginBottom: spacing.md,
    },
    tabsContent: {
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    tab: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    activeTab: {
        backgroundColor: colors.primary.main,
        borderColor: colors.primary.main,
    },
    tabText: {
        fontSize: 14,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    activeTabText: {
        color: colors.primary.contrast,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: spacing.md,
    },
    searchSection: {
        marginBottom: spacing.lg,
        position: 'relative',
    },
    searchInput: {
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        color: colors.text.primary,
        fontSize: 16,
    },
    searchLoader: {
        position: 'absolute',
        right: spacing.md,
        top: spacing.md,
    },
    searchError: {
        color: colors.status.error,
        fontSize: 14,
        marginBottom: spacing.md,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    resultsList: {
        marginBottom: spacing.lg,
    },
    resultsScroll: {
        marginHorizontal: -spacing.md,
        paddingHorizontal: spacing.md,
    },
    resultCard: {
        width: 100,
        marginRight: spacing.md,
    },
    resultImage: {
        width: 100,
        height: 150,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xs,
        backgroundColor: colors.background.tertiary,
    },
    resultTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.primary,
        marginBottom: 2,
    },
    resultYear: {
        fontSize: 10,
        color: colors.text.tertiary,
    },
    activityList: {
        gap: spacing.md,
    },
    activityCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        ...shadows.sm,
    },
    activityContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityPoster: {
        width: 50,
        height: 75,
        borderRadius: borderRadius.sm,
        marginRight: spacing.md,
    },
    placeholderPoster: {
        width: 50,
        height: 75,
        borderRadius: borderRadius.sm,
        marginRight: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
    },
    activityInfo: {
        flex: 1,
    },
    activityName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
    },
    activityStats: {
        fontSize: 13,
        color: colors.text.secondary,
    },
    logButton: {
        backgroundColor: colors.primary.main + '20',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
    },
    logButtonText: {
        color: colors.primary.main,
        fontSize: 13,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
    },
    emptyText: {
        color: colors.text.secondary,
        fontSize: 15,
        marginBottom: 4,
    },
    emptySubText: {
        color: colors.text.tertiary,
        fontSize: 13,
    },
});
