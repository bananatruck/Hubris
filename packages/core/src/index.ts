// ============================================
// Hubris Core - Main Entry Point
// ============================================

// Scoring
export {
    getPeriodBoundaries,
    getStatusLabel,
    getStatusDisplayLabel,
    calculateFrequencyScore,
    calculateOverallScore,
    getMotivationalMessage,
} from './scoring';

// Heatmap
export {
    formatDateKey,
    getDateRange,
    calculateIntensity,
    generateHeatmapData,
    generateMiniHeatmap,
    generateLogHeatmap,
} from './heatmap';

export * from './weighted-score';

// Suggestions
export {
    isAtRisk,
    isBehindPace,
    generateSuggestions,
    getHomeMotivation,
} from './suggestions';

export { generateWeeklySuggestions } from './weekly-suggestions';
