/**
 * DisplayUtils - Shared display utilities for SeNARS UI components
 * Provides common formatting and display functionality shared between different UI components
 */

export class DisplayUtils {
    /**
     * Creates a formatted table with specified headers and data
     * @param {string[]} headers - Array of column headers
     * @param {any[][]} rows - Array of row data arrays
     * @param {number[]} columnWidths - Optional array of specific column widths
     * @returns {string} Formatted table as a string
     */
    static createTable(headers, rows, columnWidths = []) {
        if (!headers || !rows) {
            return '';
        }

        // Calculate column widths if not provided
        const calculatedWidths = headers.map((header, i) => {
            const headerWidth = header.length;
            const maxDataWidth = Math.max(...rows.map(row =>
                row[i] ? String(row[i]).length : 0
            ));
            return Math.max(headerWidth, maxDataWidth, columnWidths[i] || 0, 8);
        });

        const widths = calculatedWidths.map(w => Math.min(w, 50)); // Cap widths at 50 chars

        // Create separator line
        const separator = `  ${widths.map(w => '─'.repeat(w + 2)).join('┼')}`;

        // Create header row
        const headerRow = `  ${headers.map((header, i) =>
            header.padEnd(widths[i])
        ).join(' │ ')}`;

        // Create data rows
        const dataRows = rows.map(row =>
            `  ${row.map((cell, i) =>
                String(cell || '').padEnd(widths[i])
            ).join(' │ ')}`
        );

        // Combine all parts
        return [
            `  ┌${widths.map(w => '─'.repeat(w + 2)).join('┬')}┐`,
            `  │ ${headerRow} │`,
            `  ├${widths.map(w => '─'.repeat(w + 2)).join('┼')}┤`,
            ...dataRows.map(row => `  │${row}│`),
            `  └${widths.map(w => '─'.repeat(w + 2)).join('┴')}┘`
        ].join('\n');
    }

    /**
     * Truncates text to specified length, adding ellipsis if truncated
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @param {string} ellipsis - Ellipsis to add (default: '...')
     * @returns {string} Truncated text
     */
    static truncateText(text, maxLength, ellipsis = '...') {
        if (!text) {return '';}
        const str = String(text);
        const len = maxLength - ellipsis.length;
        return str.length <= maxLength ? str : `${str.substring(0, len)}${ellipsis}`;
    }

    /**
     * Formats a number with thousand separators
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    static formatNumber(num) {
        if (typeof num !== 'number') {
            return String(num);
        }
        return num.toLocaleString();
    }

    /**
     * Formats a percentage with specified decimal places
     * @param {number} value - Percentage value (0-100 or 0-1)
     * @param {number} decimals - Number of decimal places (default: 1)
     * @returns {string} Formatted percentage
     */
    static formatPercentage(value, decimals = 1) {
        if (typeof value !== 'number') {
            return String(value);
        }
        // If value is between 0 and 1, multiply by 100
        const percent = value <= 1 ? value * 100 : value;
        return `${percent.toFixed(decimals)}%`;
    }

    /**
     * Formats file size in human readable format
     * @param {number} size - Size in bytes
     * @returns {string} Human readable size
     */
    static formatFileSize(size) {
        if (typeof size !== 'number') {
            return String(size);
        }
        if (size < 1024) {
            return `${size} B`;
        }
        if (size < 1024 * 1024) {
            return `${(size / 1024).toFixed(1)} KB`;
        }
        if (size < 1024 * 1024 * 1024) {
            return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        }
        return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    /**
     * Formats duration in milliseconds to human readable format
     * @param {number} duration - Duration in milliseconds
     * @returns {string} Human readable duration
     */
    static formatDuration(duration) {
        if (typeof duration !== 'number') {
            return String(duration);
        }
        if (duration < 1000) {
            return `${duration}ms`;
        }
        if (duration < 60000) {
            return `${(duration / 1000).toFixed(2)}s`;
        }
        return `${(duration / 60000).toFixed(2)}min`;
    }

    /**
     * Creates a progress bar string
     * @param {number} progress - Progress value (0-1)
     * @param {number} width - Width of the progress bar (default: 20)
     * @param {string} completeChar - Character for completed portion (default: '█')
     * @param {string} incompleteChar - Character for incomplete portion (default: '░')
     * @returns {string} Progress bar string
     */
    static createProgressBar(progress, width = 20, completeChar = '█', incompleteChar = '░') {
        const filled = Math.floor(progress * width);
        const empty = width - filled;
        return completeChar.repeat(filled) + incompleteChar.repeat(empty);
    }

    /**
     * Formats a simple key-value pair display
     * @param {Object} obj - Object with key-value pairs
     * @param {string} prefix - Prefix for each line (default: '  ')
     * @param {boolean} includeEmpty - Whether to include empty values (default: false)
     * @returns {string} Formatted key-value pairs
     */
    static formatKeyValuePairs(obj, prefix = '  ', includeEmpty = false) {
        if (!obj || typeof obj !== 'object') {
            return '';
        }

        const entries = Object.entries(obj);
        if (entries.length === 0) {
            return '';
        }

        const formattedEntries = entries
            .filter(([key, value]) => includeEmpty || (value != null && value !== ''))
            .map(([key, value]) => {
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const formattedValue = this._formatValue(value);
                return `${prefix}${formattedKey}: ${formattedValue}`;
            });

        return formattedEntries.join('\n');
    }

    /**
     * Formats values for display based on their type
     * @private
     * @param {*} value - Value to format
     * @returns {string} Formatted value
     */
    static _formatValue(value) {
        if (value == null) {
            return 'null';
        }
        if (typeof value === 'number') {
            if (value > 1000) {
                return this.formatNumber(value);
            }
            if (value <= 1 && value >= 0) {
                return this.formatPercentage(value);
            }
            return String(value);
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (Array.isArray(value)) {
            return `[${value.length} items]`;
        }
        if (typeof value === 'object') {
            return '{Object}';
        }
        return String(value);
    }

    /**
     * Creates an indented multi-line string
     * @param {string} text - Text to indent
     * @param {number} spaces - Number of spaces to indent (default: 2)
     * @returns {string} Indented text
     */
    static indent(text, spaces = 2) {
        if (!text) {
            return '';
        }
        const indentStr = ' '.repeat(spaces);
        return String(text).split('\n').map(line => indentStr + line).join('\n');
    }

    /**
     * Formats a list of items with emojis
     * @param {string[]} items - List of items to format
     * @param {string} emoji - Emoji prefix for each item
     * @param {string} prefix - Prefix for each line (default: '  ')
     * @returns {string} Formatted list
     */
    static formatListWithEmoji(items, emoji = '•', prefix = '  ') {
        if (!Array.isArray(items) || items.length === 0) {
            return '';
        }
        return items.map(item => `${prefix}${emoji} ${item}`).join('\n');
    }

    /**
     * Prints a DataFrame-like object as a formatted table
     * @param {Object} df - DataFrame-like object with shape, columns and values
     * @param {Object} options - Printing options
     * @param {number} options.maxRows - Maximum number of rows to display (default: 20)
     * @param {number} options.maxCols - Maximum number of columns to display (default: 10)
     * @param {number} options.precision - Decimal precision for numbers (default: 2)
     * @returns {string} Formatted table string
     */
    static printDataFrame(df, options = {}) {
        if (!df || typeof df !== 'object') {
            return '';
        }

        const {
            maxRows = 20,
            maxCols = 10,
            precision = 2
        } = options;

        try {
            // Get DataFrame dimensions
            const shape = df.shape || [0, 0];
            const rows = shape[0];
            const cols = shape[1];

            // Handle empty DataFrame
            if (rows === 0 || cols === 0) {
                return 'Empty DataFrame';
            }

            // Get column names
            const columns = df.columns || [];
            const displayColumns = columns.slice(0, maxCols);

            // Prepare headers
            const headers = displayColumns.map(col => String(col));

            // Prepare data rows
            const values = df.values || [];
            const displayRows = Math.min(rows, maxRows);
            const dataRows = Array.from({length: displayRows}, (_, i) => {
                const row = values[i] || [];
                return Array.from({length: displayColumns.length}, (_, j) => {
                    let cell = row[j];

                    // Format cell value
                    if (typeof cell === 'number' && !Number.isInteger(cell)) {
                        cell = cell.toFixed(precision);
                    } else if (cell == null) {
                        cell = 'null';
                    } else {
                        cell = String(cell);
                    }

                    return cell;
                });
            });

            // Create the table
            let table = this.createTable(headers, dataRows);

            // Add info about truncated data
            if (rows > maxRows || cols > maxCols) {
                const rowInfo = rows > maxRows ? ` (${rows - maxRows} more rows)` : '';
                const colInfo = cols > maxCols ? ` (${cols - maxCols} more columns)` : '';
                table += `\n\n[${rows} rows x ${cols} columns]${rowInfo}${colInfo}`;
            }

            return table;
        } catch (error) {
            // Fallback to simple representation if operations fail
            return `DataFrame (${df.shape ? df.shape.join('x') : 'unknown shape'})`;
        }
    }
}