// ============================================
// Hubris - Design System Theme
// ============================================

export const colors = {
    // Primary palette
    primary: {
        main: '#7C3AED',      // Vibrant purple
        light: '#A78BFA',
        dark: '#5B21B6',
        contrast: '#FFFFFF',
    },

    // Background colors (dark mode first)
    background: {
        primary: '#0a0a0f',    // Deep dark
        secondary: '#13131a',  // Card background
        tertiary: '#1c1c26',   // Elevated elements
        elevated: '#252532',   // Modals, sheets
    },

    // Text colors
    text: {
        primary: '#F8FAFC',    // White-ish
        secondary: '#94A3B8',  // Muted
        tertiary: '#64748B',   // Even more muted
        inverse: '#0a0a0f',
    },

    // Status colors (positive framing)
    status: {
        onTrack: '#22C55E',      // Green
        catchingUp: '#F59E0B',   // Amber
        needsLove: '#EC4899',    // Pink (not red!)

        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
    },

    // Heatmap intensity levels (GitHub-style)
    heatmap: {
        0: '#1c1c26',   // Empty
        1: '#3B2F5B',   // Level 1
        2: '#5B3E9E',   // Level 2
        3: '#7C3AED',   // Level 3
        4: '#A78BFA',   // Level 4 (max)
    },

    // Category colors
    category: {
        career: '#3B82F6',       // Blue
        entertainment: '#EC4899', // Pink
        'hobbies-habits': '#22C55E', // Green
    },

    // Neutral palette
    neutral: {
        50: '#F8FAFC',
        100: '#F1F5F9',
        200: '#E2E8F0',
        300: '#CBD5E1',
        400: '#94A3B8',
        500: '#64748B',
        600: '#475569',
        700: '#334155',
        800: '#1E293B',
        900: '#0F172A',
    },

    // Borders
    border: {
        default: '#252532',
        subtle: '#1c1c26',
        strong: '#334155',
    },
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const borderRadius = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
};

export const typography = {
    fontFamily: {
        regular: 'System',
        medium: 'System',
        semibold: 'System',
        bold: 'System',
    },
    fontSize: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
        xl: 20,
        '2xl': 24,
        '3xl': 30,
        '4xl': 36,
    },
    lineHeight: {
        tight: 1.25,
        normal: 1.5,
        relaxed: 1.75,
    },
};

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
};

// Animation constants
export const animation = {
    fast: 150,
    normal: 250,
    slow: 350,
};

export default {
    colors,
    spacing,
    borderRadius,
    typography,
    shadows,
    animation,
};
