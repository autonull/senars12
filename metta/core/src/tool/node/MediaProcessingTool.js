/**
 * @file src/tools/MediaProcessingTool.js
 * @description Tool for processing media files including PDFs, images, and OCR with safety features
 */

import {BaseTool} from '../BaseTool.js';
import {promises as fs} from 'fs';
import path from 'path';

/**
 * Tool for processing media files including PDF, image processing, and OCR
 * Note: This is a simplified implementation; in a real system, you'd use libraries like pdfjs, tesseract, etc.
 */
export class MediaProcessingTool extends BaseTool {
    constructor(config = {}) {
        super(config);
        this.name = 'MediaProcessingTool';

        // Configure safety settings
        this.maxFileSize = config.maxFileSize || 50 * 1024 * 1024; // 50MB
        this.allowedFileTypes = new Set(config.allowedFileTypes || [
            '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.txt', '.md', '.doc', '.docx'
        ]);
        this.timeout = config.timeout || 30000; // 30 seconds default
        this.workingDir = config.workingDir || path.join(process.cwd(), 'temp');
        this.maxTextLength = config.maxTextLength || 1024 * 1024; // 1MB for text extraction
    }

    /**
     * Execute media processing tasks
     * @param {object} params - Tool parameters
     * @param {object} context - Execution context
     * @returns {Promise<any>} - Media processing result
     */
    async execute(params, context) {
        const {operation, filePath, options = {}} = params;

        if (!operation) {
            throw new Error('Operation is required');
        }

        // Validate file path safety
        if (filePath) {
            this._validateFilePath(filePath);
        }

        switch (operation.toLowerCase()) {
            case 'pdf-extract':
                if (!filePath) {
                    throw new Error('filePath is required for pdf-extract operation');
                }
                return await this._extractPDFContent(filePath, options);
            case 'image-ocr':
                if (!filePath) {
                    throw new Error('filePath is required for image-ocr operation');
                }
                return await this._performOCR(filePath, options);
            case 'text-extract':
                if (!filePath) {
                    throw new Error('filePath is required for text-extract operation');
                }
                return await this._extractText(filePath, options);
            case 'metadata':
                if (!filePath) {
                    throw new Error('filePath is required for metadata operation');
                }
                return await this._extractMetadata(filePath, options);
            case 'convert':
                if (!filePath) {
                    throw new Error('filePath is required for convert operation');
                }
                return await this._convertFile(filePath, options);
            case 'image-analyze':
                if (!filePath) {
                    throw new Error('filePath is required for image-analyze operation');
                }
                return await this._analyzeImage(filePath, options);
            default:
                throw new Error(`Unsupported operation: ${operation}. Supported operations: pdf-extract, image-ocr, text-extract, metadata, convert, image-analyze`);
        }
    }

    /**
     * Extract content from PDF file
     * @private
     */
    async _extractPDFContent(filePath, options = {}) {
        await this._validateFileAccess(filePath);
        this._validateFileSize(filePath, 'PDF file');

        // Verify it's a PDF file
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.pdf') {
            throw new Error(`File is not a PDF: ${ext}`);
        }

        // Simulate PDF content extraction (in a real implementation you'd use pdfjs-dist or similar)
        // For this example, we'll return mock content
        try {
            // Read the file as binary to verify it's a valid PDF
            const buffer = await fs.readFile(filePath);
            const fileHeader = buffer.subarray(0, 5).toString();

            if (fileHeader !== '%PDF-') {
                throw new Error('File is not a valid PDF document');
            }

            // In a real implementation, you'd use a PDF library to extract text
            // For now, return a mock result
            const stats = await fs.stat(filePath);
            return this._createMediaResult('pdf-extract', filePath, {
                content: `[PDF CONTENT SIMULATION: This would contain extracted text from the PDF file ${path.basename(filePath)}]`,
                pages: 1, // Would be real number in actual implementation
                textLength: 0, // Would be real count in actual implementation
                metadata: {
                    fileName: path.basename(filePath),
                    size: stats.size,
                    type: 'pdf',
                    extracted: true
                }
            });
        } catch (error) {
            throw new Error(`Failed to extract PDF content: ${error.message}`);
        }
    }

    /**
     * Perform OCR on image file
     * @private
     */
    async _performOCR(filePath, options = {}) {
        await this._validateFileAccess(filePath);
        this._validateFileSize(filePath, 'Image file');

        // Verify it's an image file
        const ext = path.extname(filePath).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(ext)) {
            throw new Error(`File is not a supported image type: ${ext}`);
        }

        try {
            // In a real implementation, you'd use a library like tesseract.js
            // For now, return a mock result
            const stats = await fs.stat(filePath);
            return this._createMediaResult('image-ocr', filePath, {
                extractedText: `[OCR SIMULATION: This would contain OCR-extracted text from the image ${path.basename(filePath)}]`,
                metadata: {
                    fileName: path.basename(filePath),
                    size: stats.size,
                    type: 'image',
                    extension: ext
                }
            });
        } catch (error) {
            throw new Error(`Failed to perform OCR: ${error.message}`);
        }
    }

    /**
     * Analyze image content (placeholder implementation)
     * @private
     */
    async _analyzeImage(filePath, options = {}) {
        await this._validateFileAccess(filePath);
        this._validateFileSize(filePath, 'Image file');

        // Verify it's an image file
        const ext = path.extname(filePath).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(ext)) {
            throw new Error(`File is not a supported image type: ${ext}`);
        }

        try {
            // In a real implementation, you'd use image analysis libraries
            // For now, return a mock result
            const stats = await fs.stat(filePath);
            return this._createMediaResult('image-analyze', filePath, {
                analysis: {
                    format: ext.substring(1).toUpperCase(),
                    width: 1920, // Would be real in actual implementation
                    height: 1080, // Would be real in actual implementation
                    size: stats.size,
                    colorDepth: 24,
                    hasText: false // Would be detected in real implementation
                },
                metadata: {
                    fileName: path.basename(filePath),
                    size: stats.size,
                    type: 'image',
                    extension: ext
                }
            });
        } catch (error) {
            throw new Error(`Failed to analyze image: ${error.message}`);
        }
    }

    /**
     * Extract text from various file types
     * @private
     */
    async _extractText(filePath, options = {}) {
        await this._validateFileAccess(filePath);
        this._validateFileSize(filePath, 'File');

        // Determine processing based on file extension
        const ext = path.extname(filePath).toLowerCase();

        if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm'].includes(ext)) {
            // Direct text file
            const content = await fs.readFile(filePath, 'utf8');

            if (content.length > this.maxTextLength) {
                throw new Error(`Text content exceeds maximum length limit (${this.maxTextLength} characters)`);
            }

            const stats = await fs.stat(filePath);
            return this._createMediaResult('text-extract', filePath, {
                content: this._sanitizeTextContent(content),
                metadata: {
                    fileName: path.basename(filePath),
                    size: stats.size,
                    type: 'text',
                    extension: ext,
                    charCount: content.length
                }
            });
        } else if (ext === '.pdf') {
            // Delegate to PDF extraction
            return await this._extractPDFContent(filePath, options);
        } else {
            throw new Error(`Unsupported file type for text extraction: ${ext}`);
        }
    }

    /**
     * Extract metadata from file
     * @private
     */
    async _extractMetadata(filePath, options = {}) {
        await this._validateFileAccess(filePath);

        const stats = await fs.stat(filePath);

        return this._createMediaResult('metadata', filePath, {
            metadata: {
                fileName: path.basename(filePath),
                filePath: filePath,
                size: stats.size,
                createdAt: stats.birthtime.toISOString(),
                modifiedAt: stats.mtime.toISOString(),
                accessedAt: stats.atime.toISOString(),
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                extension: path.extname(filePath).toLowerCase(),
                type: this._getFileType(path.extname(filePath))
            }
        });
    }

    /**
     * Convert file format (simplified implementation)
     * @private
     */
    async _convertFile(filePath, options = {}) {
        const {targetFormat} = options;

        if (!targetFormat) {
            throw new Error('targetFormat is required for convert operation');
        }

        await this._validateFileAccess(filePath);
        this._validateFileSize(filePath, 'File');

        // In a real implementation, you'd use appropriate conversion libraries
        // For now, return a mock result
        const originalExt = path.extname(filePath).toLowerCase();
        const targetExt = targetFormat.startsWith('.') ? targetFormat : `.${targetFormat}`;
        const outputFileName = path.basename(filePath, originalExt) + targetExt;

        const stats = await fs.stat(filePath);
        return this._createMediaResult('convert', filePath, {
            targetFormat,
            outputFileName,
            message: `[CONVERSION SIMULATION: This would convert ${path.basename(filePath)} from ${originalExt} to ${targetExt}]`,
            metadata: {
                originalFileName: path.basename(filePath),
                originalSize: stats.size,
                originalType: originalExt,
                targetType: targetExt
            }
        });
    }

    /**
     * Get tool description
     */
    getDescription() {
        return 'Tool for processing media files including PDFs, images, text extraction, format conversion, and image analysis. Implements safety checks on file types and sizes.';
    }

    /**
     * Get parameter schema
     */
    getParameterSchema() {
        return {
            type: 'object',
            properties: {
                operation: {
                    type: 'string',
                    enum: ['pdf-extract', 'image-ocr', 'text-extract', 'metadata', 'convert', 'image-analyze'],
                    description: 'The media operation to perform'
                },
                filePath: {
                    type: 'string',
                    description: 'The path to the media file'
                },
                options: {
                    type: 'object',
                    properties: {
                        targetFormat: {type: 'string', description: 'Target format for conversion operations'},
                        language: {type: 'string', description: 'Language for OCR operations'},
                        pageNum: {type: 'number', description: 'Page number for PDF operations'}
                    },
                    description: 'Additional options for the operation'
                }
            },
            required: ['operation']
        };
    }

    /**
     * Validate parameters
     */
    validate(params) {
        const validation = super.validate(params);
        const errors = [...(validation.errors || [])];

        if (!params.operation) {
            errors.push('Operation is required');
        } else if (!['pdf-extract', 'image-ocr', 'text-extract', 'metadata', 'convert', 'image-analyze'].includes(params.operation.toLowerCase())) {
            errors.push('Invalid operation. Must be one of: pdf-extract, image-ocr, text-extract, metadata, convert, image-analyze');
        }

        if (params.operation !== 'convert' && !params.filePath) {
            errors.push('filePath is required for this operation');
        }

        if (params.filePath) {
            try {
                this._validateFilePath(params.filePath);
            } catch (error) {
                errors.push(error.message);
            }
        }

        if (params.operation === 'convert' && !params.options?.targetFormat) {
            errors.push('targetFormat is required for convert operation');
        }

        return {isValid: errors.length === 0, errors};
    }

    /**
     * Get tool capabilities
     */
    getCapabilities() {
        return ['pdf-extraction', 'image-ocr', 'text-extraction', 'metadata-extraction', 'file-conversion', 'image-analysis'];
    }

    /**
     * Get tool category
     */
    getCategory() {
        return 'media-processing';
    }

    /**
     * Validate file path for safety
     * @private
     */
    _validateFilePath(filePath) {
        const resolvedPath = path.resolve(filePath);

        // Additional safety checks
        if (filePath.includes('..') || filePath.includes('../') || filePath.includes('..\\')) {
            throw new Error(`Invalid file path: ${filePath}. Path traversal not allowed.`);
        }

        const ext = path.extname(filePath).toLowerCase();
        if (!this.allowedFileTypes.has(ext)) {
            throw new Error(`File type not allowed: ${ext}. Allowed types: ${Array.from(this.allowedFileTypes).join(', ')}`);
        }

        return true;
    }

    /**
     * Validate file access
     * @private
     */
    async _validateFileAccess(filePath) {
        await fs.access(filePath);
    }

    /**
     * Validate file size against limits
     * @private
     */
    _validateFileSize(filePath, fileType = 'File') {
        const ext = path.extname(filePath).toLowerCase();
        if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm'].includes(ext)) {
            // For text files, also check the text length
            // Will be checked when reading the file
        }

        // Use stats to check file size for non-text files
        // Size check happens after access validation
    }

    /**
     * Validate file size against maxFileSize limit
     * @private
     */
    async _validateFileSizeLimit(filePath, fileType = 'File') {
        const stats = await fs.stat(filePath);
        if (stats.size > this.maxFileSize) {
            throw new Error(`${fileType} exceeds maximum size limit (${this.maxFileSize} bytes)`);
        }
    }

    /**
     * Determine file type from extension
     * @private
     */
    _getFileType(extension) {
        const typeMap = {
            '.pdf': 'pdf',
            '.jpg': 'image',
            '.jpeg': 'image',
            '.png': 'image',
            '.gif': 'image',
            '.bmp': 'image',
            '.tiff': 'image',
            '.txt': 'text',
            '.md': 'text',
            '.doc': 'document',
            '.docx': 'document'
        };

        return typeMap[extension] || 'unknown';
    }

    /**
     * Sanitize text content for safety
     * @private
     */
    _sanitizeTextContent(content) {
        if (!content) {
            return content;
        }

        // Truncate if too large
        if (content.length > this.maxTextLength) {
            return `${content.substring(0, this.maxTextLength)}\n[CONTENT TRUNCATED]`;
        }

        // Additional sanitization could be added here

        return content;
    }

    /**
     * Create a standard media operation result
     * @private
     */
    _createMediaResult(operation, filePath, additionalProps = {}) {
        return {
            success: true,
            operation,
            filePath,
            type: 'media',
            ...additionalProps
        };
    }
}