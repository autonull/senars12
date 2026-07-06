/**
 * @file src/tools/WebAutomationTool.js
 * @description Tool for web automation and web-based operations with safety features
 */

import {BaseTool} from '../BaseTool.js';
import {Logger} from '../../util/Logger.js';

/**
 * Tool for web automation including navigation, scraping, and basic interactions
 * Note: This is a simplified implementation; in a real system, you'd likely use Puppeteer or Playwright
 */
export class WebAutomationTool extends BaseTool {
    constructor(config = {}) {
        super(config);
        this.name = 'WebAutomationTool';

        // Configure safety settings
        this.allowedDomains = new Set(config.allowedDomains || [
            'example.com', 'localhost', '127.0.0.1', '0.0.0.0', 'github.com',
            'wikipedia.org', 'openai.com', 'google.com', 'bing.com'
        ]);

        this.timeout = config.timeout || 30000; // 30 seconds default
        this.maxResponseSize = config.maxResponseSize || 1024 * 1024; // 1MB
        this.userAgent = config.userAgent || 'SENARS-WebAutomation/1.0';
        this.maxRedirects = config.maxRedirects || 5;
        this.enableCookies = config.enableCookies !== false; // Enable by default

        // For demonstration, we'll use the built-in fetch API
        // In a production system, you would likely use Puppeteer, Playwright, or similar
        this.supportedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'];
    }

    /**
     * Execute web automation tasks
     * @param {object} params - Tool parameters
     * @param {object} context - Execution context
     * @returns {Promise<any>} - Web automation result
     */
    async execute(params, context) {
        const {operation, url, method = 'GET', headers = {}, body, options = {}} = params;

        if (!operation) {
            throw new Error('Operation is required');
        }

        switch (operation.toLowerCase()) {
            case 'get':
            case 'fetch':
                if (!url) {
                    throw new Error('URL is required for fetch operation');
                }
                return await this._fetchUrl(url, {method: 'GET', headers, ...options});
            case 'post':
                if (!url) {
                    throw new Error('URL is required for POST operation');
                }
                return await this._fetchUrl(url, {method: 'POST', headers, body, ...options});
            case 'scrape':
                if (!url) {
                    throw new Error('URL is required for scrape operation');
                }
                return await this._scrapeUrl(url, {headers, ...options});
            case 'check':
                if (!url) {
                    throw new Error('URL is required for check operation');
                }
                return await this._checkUrl(url, {headers, ...options});
            case 'head':
                if (!url) {
                    throw new Error('URL is required for HEAD operation');
                }
                return await this._headRequest(url, {headers, ...options});
            default:
                throw new Error(`Unsupported operation: ${operation}. Supported operations: get, post, scrape, check, head`);
        }
    }

    /**
     * Fetch URL with options
     * @private
     */
    async _fetchUrl(url, options = {}) {
        this._validateUrl(url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        const startTime = Date.now();

        try {
            const requestHeaders = {
                'User-Agent': this.userAgent,
                ...options.headers
            };

            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: requestHeaders,
                body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
                signal: controller.signal,
                redirect: 'follow', // Follow redirects up to maxRedirects
                // Note: fetch API doesn't directly support maxRedirects option, would need to implement manually
            });

            clearTimeout(timeoutId);

            const content = await response.text();

            if (content.length > this.maxResponseSize) {
                throw new Error(`Response exceeds maximum size: ${this.maxResponseSize} bytes`);
            }

            return this._createWebResponse('fetch', url, response, content, startTime);
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${this.timeout}ms`);
            }

            throw new Error(`Failed to fetch URL: ${error.message}`);
        }
    }

    /**
     * Scrape content from a URL
     * @private
     */
    async _scrapeUrl(url, options = {}) {
        const result = await this._fetchUrl(url, {...options, method: 'GET'});

        if (!result.success) {
            return result;
        }

        // Simple text extraction - in a real implementation you'd use a proper HTML parser
        const scraped = this._extractContent(result.content);

        return {
            ...result,
            operation: 'scrape',
            extractedContent: scraped,
            title: scraped.title,
            textContent: scraped.textContent,
            links: scraped.links,
            images: scraped.images
        };
    }

    /**
     * Check URL accessibility
     * @private
     */
    async _checkUrl(url, options = {}) {
        this._validateUrl(url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        const startTime = Date.now();

        try {
            const requestHeaders = {
                'User-Agent': this.userAgent,
                ...options.headers
            };

            const response = await fetch(url, {
                method: 'GET',
                headers: requestHeaders,
                signal: controller.signal,
                redirect: 'follow'
            });

            clearTimeout(timeoutId);

            return this._createCheckResponse(url, response, startTime);
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error(`Check request timed out after ${this.timeout}ms`);
            }

            return {
                success: false,
                operation: 'check',
                url,
                error: error.message,
                accessible: false
            };
        }
    }

    /**
     * Perform HEAD request
     * @private
     */
    async _headRequest(url, options = {}) {
        this._validateUrl(url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        const startTime = Date.now();

        try {
            const requestHeaders = {
                'User-Agent': this.userAgent,
                ...options.headers
            };

            const response = await fetch(url, {
                method: 'HEAD',
                headers: requestHeaders,
                signal: controller.signal,
                redirect: 'follow'
            });

            clearTimeout(timeoutId);

            return this._createHeadResponse(url, response, startTime);
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error(`HEAD request timed out after ${this.timeout}ms`);
            }

            return {
                success: false,
                operation: 'head',
                url,
                error: error.message,
                accessible: false
            };
        }
    }

    /**
     * Create a web response object
     * @private
     */
    _createWebResponse(operation, url, response, content, startTime) {
        return {
            success: true,
            operation,
            url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            content: this._sanitizeContent(content),
            size: content.length,
            contentType: response.headers.get('content-type') || 'unknown',
            duration: Date.now() - startTime
        };
    }

    /**
     * Create a check response object
     * @private
     */
    _createCheckResponse(url, response, startTime) {
        return {
            success: response.ok,
            operation: 'check',
            url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            accessible: response.ok,
            contentType: response.headers.get('content-type') || 'unknown',
            duration: Date.now() - startTime
        };
    }

    /**
     * Create a HEAD response object
     * @private
     */
    _createHeadResponse(url, response, startTime) {
        return {
            success: response.ok,
            operation: 'head',
            url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            accessible: response.ok,
            duration: Date.now() - startTime
        };
    }

    /**
     * Get tool description
     */
    getDescription() {
        return 'Tool for web automation including fetching, scraping, checking, and HEAD requests. Implements safety restrictions on allowed domains.';
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
                    enum: ['get', 'fetch', 'post', 'scrape', 'check', 'head'],
                    description: 'The web operation to perform'
                },
                url: {
                    type: 'string',
                    description: 'The target URL'
                },
                method: {
                    type: 'string',
                    enum: this.supportedMethods,
                    default: 'GET',
                    description: 'HTTP method (default: GET)'
                },
                headers: {
                    type: 'object',
                    description: 'Request headers',
                    additionalProperties: {type: 'string'}
                },
                body: {
                    type: 'object',
                    description: 'Request body for POST/PUT operations'
                },
                options: {
                    type: 'object',
                    description: 'Additional options for the request'
                }
            },
            required: ['operation', 'url']
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
        } else if (!['get', 'fetch', 'post', 'scrape', 'check', 'head'].includes(params.operation.toLowerCase())) {
            errors.push('Invalid operation. Must be one of: get, fetch, post, scrape, check, head');
        }

        if (!params.url) {
            errors.push('URL is required');
        } else {
            try {
                this._validateUrl(params.url);
            } catch (error) {
                errors.push(error.message);
            }
        }

        return {isValid: errors.length === 0, errors};
    }

    /**
     * Get tool capabilities
     */
    getCapabilities() {
        return ['web-fetch', 'web-scrape', 'web-check', 'http-requests', 'web-head', 'url-validation'];
    }

    /**
     * Get tool category
     */
    getCategory() {
        return 'web-automation';
    }

    /**
     * Validate URL for safety
     * @private
     */
    _validateUrl(url) {
        try {
            const parsedUrl = new URL(url);
            const domain = parsedUrl.hostname.toLowerCase();

            // Check if domain is in allowed list
            const isAllowed = Array.from(this.allowedDomains).some(allowed =>
                domain === allowed || domain.endsWith(`.${allowed}`)
            );

            if (!isAllowed) {
                throw new Error(`Domain "${domain}" is not in the allowed list`);
            }

            // Additional safety checks
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                throw new Error(`Protocol "${parsedUrl.protocol}" is not allowed. Only http and https are allowed.`);
            }

            // Check for suspicious paths
            if (parsedUrl.pathname.includes('../') || parsedUrl.pathname.includes('..\\')) {
                throw new Error('URL path contains directory traversal characters');
            }

            return true;
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error(`Invalid URL format: ${url}`);
            }
            throw error;
        }
    }

    /**
     * Extract content from HTML
     * @private
     */
    _extractContent(html) {
        // Simple content extraction without external dependencies
        // In a real implementation you'd use a proper HTML parser

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';

        // Extract text content (crude method)
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')  // Remove styles
            .replace(/<[^>]+>/g, ' ')  // Remove tags
            .replace(/\s+/g, ' ')     // Normalize whitespace
            .trim();

        // Extract links
        const linkMatches = html.match(/href\s*=\s*["']([^"']+)["']/gi) || [];
        const links = linkMatches.map(match => {
            try {
                const href = match.split('=')[1].replace(/["']/g, '');
                return new URL(href, 'https://example.com').href;
            } catch (error) {
                Logger.debug('Failed to parse link href', {match});
                return null;
            }
        }).filter(Boolean);

        // Extract images
        const imgMatches = html.match(/src\s*=\s*["']([^"']+)["']/gi) || [];
        const images = imgMatches.map(match => {
            try {
                const src = match.split('=')[1].replace(/["']/g, '');
                return new URL(src, 'https://example.com').href;
            } catch (error) {
                Logger.debug('Failed to parse image src', {match});
                return null;
            }
        }).filter(Boolean);

        return {
            title,
            textContent,
            links: links.slice(0, 50), // Limit to first 50 links
            images: images.slice(0, 20) // Limit to first 20 images
        };
    }

    /**
     * Sanitize content for safety
     * @private
     */
    _sanitizeContent(content) {
        // Remove potential script tags and other dangerous content
        return content
            .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
            .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
            .replace(/javascript:/gi, 'safe-javascript:') // Sanitize javascript: URLs
            .replace(/on\w+\s*=/gi, 'safe-$&'); // Sanitize event handlers
    }
}