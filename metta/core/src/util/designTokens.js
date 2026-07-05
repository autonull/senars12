/**
 * Shared design tokens for consistent styling across CLI and web UI.
 * Single source of truth for colors, timing, and spacing.
 */
export const DESIGN_TOKENS = Object.freeze({
    colors: Object.freeze({
        // Node types
        concept: '#4ec9b0',
        task: '#ff8c00',
        question: '#9d68f0',
        goal: '#ffd700',
        edge: '#dcdcdc',

        // Edge/Relation types
        inheritance: '#4ec9b0', // Matches concept (teal)
        similarity: '#9d68f0',   // Matches question (purple)
        implication: '#569cd6',  // Blue
        relation: '#808080',     // Gray (default for other relations)

        // Animation/Interaction
        highlight: '#ffeb3b',    // Bright yellow for focus/pulse
        dim: '#404040',          // Dimmed state

        // Status/feedback
        success: 'green',
        error: 'red',
        info: 'blue',
        warning: 'yellow',
        user: 'yellow',
        toolCall: 'cyan'
    }),

    // High-contrast color palette (for accessibility)
    colorsHighContrast: Object.freeze({
        concept: '#00ffcc',
        task: '#ffaa00',
        question: '#cc88ff',
        goal: '#ffff00',
        edge: '#ffffff',
        inheritance: '#00ffcc',
        similarity: '#cc88ff',
        implication: '#66ccff',
        relation: '#cccccc',
        highlight: '#ffff00',
        dim: '#666666',
        background: '#000000',
        text: '#ffffff'
    }),

    timing: Object.freeze({
        pulse: 300,
        transition: 150,
        debounce: 100,
        glow: 400  // Glow animation duration
    }),

    spacing: Object.freeze({
        nodePadding: 8,
        panelGap: 16
    })
});

// Terminal ANSI color codes for CLI formatting
export const ANSI_COLORS = Object.freeze({
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    fg: Object.freeze({
        black: '\x1b[30m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
        blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
        brightBlack: '\x1b[90m', brightRed: '\x1b[91m', brightGreen: '\x1b[92m', brightYellow: '\x1b[93m',
        brightBlue: '\x1b[94m', brightMagenta: '\x1b[95m', brightCyan: '\x1b[96m', brightWhite: '\x1b[97m'
    }),
    bg: Object.freeze({
        black: '\x1b[40m', red: '\x1b[41m', green: '\x1b[42m', yellow: '\x1b[43m',
        blue: '\x1b[44m', magenta: '\x1b[45m', cyan: '\x1b[46m', white: '\x1b[47m',
        brightBlack: '\x1b[100m', brightRed: '\x1b[101m', brightGreen: '\x1b[102m', brightYellow: '\x1b[103m',
        brightBlue: '\x1b[104m', brightMagenta: '\x1b[105m', brightCyan: '\x1b[106m', brightWhite: '\x1b[107m'
    })
});
