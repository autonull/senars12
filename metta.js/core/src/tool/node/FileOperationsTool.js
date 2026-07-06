/**
 * @file src/tools/FileOperationsTool.js
 * @description Tool for file operations with safety validations
 */

import {BaseTool} from '../BaseTool.js';
import {promises as fs} from 'fs';
import path from 'path';

/**
 * Tool for safe file operations (read, write, append, list)
 * Implements safety restrictions to prevent malicious file access
 */
export class FileOperationsTool extends BaseTool {
    constructor(config = {}) {
        super(config);
        this.name = 'FileOperationsTool';

        // Define safe base directories for operations
        this.safeBaseDirs = config.safeBaseDirs || [
            path.join(process.cwd(), 'work'),
            path.join(process.cwd(), 'data'),
            path.join(process.cwd(), 'temp')
        ];

        // Default file size limit (10MB)
        this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024;
        this.defaultEncoding = config.defaultEncoding || 'utf8';
        this.backupEnabled = config.backupEnabled !== false; // Enable by default
    }

    /**
     * Execute file operations based on the operation type
     * @param {object} params - Tool parameters
     * @param {object} context - Execution context
     * @returns {Promise<any>} - Operation result
     */
    async execute(params, context) {
        const {operation, filePath, content, encoding = this.defaultEncoding} = params;

        if (!operation || !filePath) {
            throw new Error('Operation and filePath are required parameters');
        }

        // Ensure the file path is within safe directories
        this._validateFilePath(filePath);

        switch (operation.toLowerCase()) {
            case 'read':
                return await this._readFile(filePath, encoding);
            case 'write':
                if (content === undefined) {
                    throw new Error('Content is required for write operation');
                }
                return await this._writeFile(filePath, content, encoding);
            case 'append':
                if (content === undefined) {
                    throw new Error('Content is required for append operation');
                }
                return await this._appendFile(filePath, content, encoding);
            case 'delete':
                return await this._deleteFile(filePath);
            case 'list':
                return await this._listDirectory(path.dirname(filePath));
            case 'stat':
                return await this._getFileInfo(filePath);
            case 'edit':
                if (!content) {
                    throw new Error('Content is required for edit operation');
                }
                return await this._editFile(filePath, content, encoding);
            default:
                throw new Error(`Unsupported operation: ${operation}. Supported operations: read, write, append, delete, list, stat, edit`);
        }
    }

    /**
     * Read file content
     * @private
     */
    async _readFile(filePath, encoding) {
        try {
            // Check file size first to prevent reading huge files
            const stats = await fs.stat(filePath);
            if (stats.size > this.maxFileSize) {
                throw new Error(`File exceeds maximum size limit (${this.maxFileSize} bytes)`);
            }

            const content = await fs.readFile(filePath, encoding);
            return this._createFileResult('read', filePath, {content, size: stats.size});
        } catch (error) {
            this._handleFileError(error, filePath, 'read');
        }
    }

    /**
     * Write content to file with backup option
     * @private
     */
    async _writeFile(filePath, content, encoding) {
        try {
            await this._createBackupIfNeeded(filePath);

            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, {recursive: true});

            // Convert content to string if not already
            const fileContent = this._ensureStringContent(content);

            await fs.writeFile(filePath, fileContent, encoding);

            return this._createFileResult('write', filePath, {
                size: Buffer.byteLength(fileContent, encoding),
                backupCreated: this.backupEnabled
            });
        } catch (error) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }

    /**
     * Append content to file
     * @private
     */
    async _appendFile(filePath, content, encoding) {
        try {
            // Convert content to string if not already
            const fileContent = this._ensureStringContent(content);

            await fs.appendFile(filePath, fileContent, encoding);

            return this._createFileResult('append', filePath, {
                size: Buffer.byteLength(fileContent, encoding)
            });
        } catch (error) {
            throw new Error(`Failed to append to file: ${error.message}`);
        }
    }

    /**
     * Delete file
     * @private
     */
    async _deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            return this._createFileResult('delete', filePath);
        } catch (error) {
            this._handleFileError(error, filePath, 'delete');
        }
    }

    /**
     * List directory contents
     * @private
     */
    async _listDirectory(dirPath) {
        try {
            // Validate directory path
            this._validateFilePath(dirPath);

            const items = await fs.readdir(dirPath, {withFileTypes: true});

            const fileList = items.map(item => ({
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file',
                path: path.join(dirPath, item.name)
            }));

            return {
                success: true,
                operation: 'list',
                directory: dirPath,
                files: fileList,
                count: fileList.length
            };
        } catch (error) {
            throw new Error(`Failed to list directory: ${error.message}`);
        }
    }

    /**
     * Get file information
     * @private
     */
    async _getFileInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);

            return {
                success: true,
                operation: 'stat',
                filePath,
                info: {
                    size: stats.size,
                    isFile: stats.isFile(),
                    isDirectory: stats.isDirectory(),
                    isSymbolicLink: stats.isSymbolicLink(),
                    atime: stats.atime.toISOString(),
                    mtime: stats.mtime.toISOString(),
                    ctime: stats.ctime.toISOString(),
                    birthtime: stats.birthtime.toISOString()
                },
                type: 'file'
            };
        } catch (error) {
            this._handleFileError(error, filePath, 'stat');
        }
    }

    /**
     * Edit file content (for now, just replace the entire file)
     * @private
     */
    async _editFile(filePath, content, encoding) {
        try {
            await this._createBackupIfNeeded(filePath);

            // Convert content to string if not already
            const fileContent = this._ensureStringContent(content);

            await fs.writeFile(filePath, fileContent, encoding);

            return this._createFileResult('edit', filePath, {
                backupCreated: this.backupEnabled
            });
        } catch (error) {
            throw new Error(`Failed to edit file: ${error.message}`);
        }
    }

    /**
     * Get tool description
     */
    getDescription() {
        return 'Tool for secure file operations including read, write, append, delete, list, stat, and edit operations. Only operates within safe directories.';
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
                    enum: ['read', 'write', 'append', 'delete', 'list', 'stat', 'edit'],
                    description: 'The file operation to perform'
                },
                filePath: {
                    type: 'string',
                    description: 'The path to the file or directory'
                },
                content: {
                    type: 'string',
                    description: 'Content to write, append, or edit (required for write/append/edit operations)'
                },
                encoding: {
                    type: 'string',
                    default: this.defaultEncoding,
                    description: `File encoding (default: ${this.defaultEncoding})`
                }
            },
            required: ['operation', 'filePath']
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
        } else if (!['read', 'write', 'append', 'delete', 'list', 'stat', 'edit'].includes(params.operation.toLowerCase())) {
            errors.push('Invalid operation. Must be one of: read, write, append, delete, list, stat, edit');
        }

        if (!params.filePath) {
            errors.push('filePath is required');
        } else {
            try {
                this._validateFilePath(params.filePath);
            } catch (error) {
                errors.push(error.message);
            }
        }

        if (['write', 'append', 'edit'].includes(params.operation?.toLowerCase())) {
            if (params.content === undefined) {
                errors.push('Content is required for write/append/edit operations');
            }
        }

        return {isValid: errors.length === 0, errors};
    }

    /**
     * Get tool capabilities
     */
    getCapabilities() {
        return ['file-read', 'file-write', 'file-append', 'file-delete', 'file-list', 'file-stat', 'file-edit'];
    }

    /**
     * Get tool category
     */
    getCategory() {
        return 'file-operations';
    }

    /**
     * Validate that the file path is within safe directories
     * @private
     */
    _validateFilePath(filePath) {
        const resolvedPath = path.resolve(filePath);
        const isSafe = this.safeBaseDirs.some(safeDir => {
            const resolvedSafeDir = path.resolve(safeDir);
            return resolvedPath.startsWith(resolvedSafeDir + path.sep) || resolvedPath === resolvedSafeDir;
        });

        if (!isSafe) {
            throw new Error(`File path is not within safe directories: ${filePath}`);
        }

        // Additional safety checks
        if (filePath.includes('..') || filePath.includes('../') || filePath.includes('..\\')) {
            throw new Error(`Invalid file path: ${filePath}. Path traversal not allowed.`);
        }

        return true;
    }

    /**
     * Create a standard file operation result
     * @private
     */
    _createFileResult(operation, filePath, additionalProps = {}) {
        return {
            success: true,
            operation,
            filePath,
            type: 'file',
            ...additionalProps
        };
    }

    /**
     * Handle file system errors consistently
     * @private
     */
    _handleFileError(error, filePath, operation) {
        if (error.code === 'ENOENT') {
            throw new Error(`File not found: ${filePath}`);
        }
        throw new Error(`Failed to ${operation} file: ${error.message}`);
    }

    /**
     * Ensure content is a string (convert objects to JSON if needed)
     * @private
     */
    _ensureStringContent(content) {
        return typeof content === 'string' ? content : JSON.stringify(content);
    }

    /**
     * Create a backup if enabled and file exists
     * @private
     */
    async _createBackupIfNeeded(filePath) {
        if (this.backupEnabled) {
            try {
                await fs.access(filePath);
                const backupPath = `${filePath}.backup.${Date.now()}`;
                await fs.copyFile(filePath, backupPath);
            } catch (error) {
                // File doesn't exist, no backup needed
            }
        }
    }
}