/**
 * Serialization utilities for SeNARS
 * Following AGENTS.md guidelines for elegant, consolidated, consistent, organized, and DRY code
 */

import { Logger } from './Logger.js';
import { DeserializationError } from './error.js';

/**
 * Safe serialization utility that handles conditional serialization
 * @param {Object} obj - Object to serialize
 * @param {Function} fallback - Fallback serialization method (e.g., toString)
 * @returns {Object} Serialized object or fallback result
 */
export function safeSerialize(obj, fallback = null) {
    if (!obj) {return null;}
    
    if (typeof obj.serialize === 'function') {
        return obj.serialize();
    }
    
    if (fallback && typeof fallback === 'function') {
        return fallback(obj);
    }
    
    if (typeof obj.toString === 'function') {
        return obj.toString();
    }
    
    return obj;
}

/**
 * Safe deserialization utility that handles conditional deserialization
 * @param {Object} data - Data to deserialize
 * @param {Function} deserializer - Deserializer function
 * @param {string} entityType - Type of entity being deserialized (for error context)
 * @returns {Object} Deserialized object
 */
export async function safeDeserialize(data, deserializer, entityType = 'unknown') {
    if (!data) {return null;}
    
    if (typeof deserializer === 'function') {
        try {
            return await deserializer(data);
        } catch (error) {
            const deserializationError = new DeserializationError(
                `Error during safe deserialization of ${entityType}: ${error.message}`,
                entityType,
                data
            );
            Logger.error('Deserialization failed:', deserializationError);
            return null;
        }
    }
    
    return data;
}

/**
 * Base serializable class to be extended by components that need serialization
 */
export class Serializable {
    /**
     * Serialize the object with standard version field
     * @param {Object} data - Additional data to include in serialization
     * @param {string} version - Version string (defaults to '1.0.0')
     * @returns {Object} Serialized object with version field
     */
    static serializeWithVersion(data = {}, version = '1.0.0') {
        return {
            ...data,
            version
        };
    }
    
    /**
     * Create a standardized serialization wrapper
     * @param {Object} obj - Object to serialize
     * @param {Function} serializer - Specific serializer function
     * @param {string} version - Version string
     * @returns {Object} Serialized object with version
     */
    static createSerializer(obj, serializer, version = '1.0.0') {
        return this.serializeWithVersion(serializer(obj), version);
    }
    
    /**
     * Standardized deserialization with error handling
     * @param {Object} data - Data to deserialize
     * @param {Function} deserializer - Specific deserializer function
     * @param {string} context - Context for error logging
     * @param {string} entityType - Type of entity being deserialized
     * @returns {boolean} Success status
     */
    static async standardDeserialize(data, deserializer, context = 'deserialization', entityType = 'unknown') {
        try {
            if (!data) {
                throw new DeserializationError(
                    `Invalid ${context} data for ${entityType}`,
                    entityType,
                    data
                );
            }
            
            await deserializer(data);
            return true;
        } catch (error) {
            const deserializationError = error instanceof DeserializationError 
                ? error 
                : new DeserializationError(
                    `Error during ${context} of ${entityType}: ${error.message}`,
                    entityType,
                    data
                  );
            Logger.error(`Deserialization failed for ${entityType}:`, deserializationError);
            return false;
        }
    }
}

/**
 * Mixin for adding serialization capabilities to classes
 * @param {Function} superclass - Class to extend
 * @returns {Function} Extended class with serialization methods
 */
export function SerializableMixin(superclass) {
    return class extends superclass {
        /**
         * Default serialize method that includes version
         * @returns {Object} Serialized object with version
         */
        serialize() {
            // Subclasses should override this method
            // This is just a default implementation
            return Serializable.serializeWithVersion({}, '1.0.0');
        }
        
        /**
         * Default deserialize method with error handling
         * @param {Object} data - Data to deserialize
         * @returns {Promise<boolean>} Success status
         */
        async deserialize(data) {
            // Subclasses should override this method
            return Serializable.standardDeserialize(
                data, 
                async () => {}, 
                this.constructor.name,
                this.constructor.name
            );
        }
    };
}

/**
 * Generic serializer that can handle multiple types of objects
 * @param {Object} obj - Object to serialize
 * @param {Object} options - Serialization options
 * @returns {Object} Serialized object
 */
export function universalSerialize(obj, options = {}) {
    const { 
        includeType = true, 
        version = '1.0.0',
        customSerializers = {}
    } = options;
    
    if (!obj) {return null;}
    
    // Check for custom serializers first
    const objType = obj.constructor?.name;
    if (customSerializers[objType]) {
        return customSerializers[objType](obj);
    }
    
    // Use safe serialization
    const serialized = safeSerialize(obj);
    
    // Add metadata if requested
    return includeType 
        ? Serializable.serializeWithVersion(
            { ...serialized, __type: objType }, 
            version
          )
        : Serializable.serializeWithVersion(serialized, version);
}

/**
 * Generic deserializer that can handle multiple types of objects
 * @param {Object} data - Data to deserialize
 * @param {Object} options - Deserialization options
 * @returns {Object} Deserialized object
 */
export async function universalDeserialize(data, options = {}) {
    const { 
        typeMap = {},
        customDeserializers = {}
    } = options;
    
    if (!data) {return null;}
    
    try {
        // Extract type if present
        const objType = data.__type;
        
        // Check for custom deserializers first
        if (objType && customDeserializers[objType]) {
            return await customDeserializers[objType](data);
        }
        
        // Use type mapping if available
        if (objType && typeMap[objType]) {
            const DeserializerClass = typeMap[objType];
            if (typeof DeserializerClass.deserialize === 'function') {
                return await DeserializerClass.deserialize(data);
            }
        }
        
        // Fallback to safe deserialization
        return data;
    } catch (error) {
        const deserializationError = new DeserializationError(
            `Universal deserialization failed: ${error.message}`,
            'universal',
            data
        );
        Logger.error('Universal deserialization failed:', deserializationError);
        return null;
    }
}