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
} from './heatmap';

// Suggestions
export {
    isAtRisk,
    generateSuggestions,
    getHomeMotivation,
} from './suggestions';
