/**
 * Generic validator for Contribution + catalog uniqueness.
 *
 * Replaces:
 *   - `contribution-validator.ts` (231 lines) — per-registry validators
 *   - with one generic validator over Contribution + catalog uniqueness
 */

import type { Contribution } from './contribution.js';
import type { Catalog } from './catalog.js';

export interface ValidationError {
  catalog: string;
  id: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Generic validator for a Contribution. */
export interface ContributionValidator<F extends Record<string, unknown>> {
  /** Validate required fields (id, label). */
  validateRequired(contribution: Contribution<F>): ValidationError[];
  /** Validate catalog-specific fields. */
  validateCatalog(contribution: Contribution<F>): ValidationError[];
  /** Validate uniqueness in a catalog. */
  validateUnique(catalog: string, id: string, existingCatalogs: Map<string, Catalog<any>>): ValidationError | null;
}

/** Default validator — checks id, label, and uniqueness. */
export function createDefaultValidator<F extends Record<string, unknown>>(
  catalogName: string
): ContributionValidator<F> {
  return {
    validateRequired(contribution: Contribution<F>): ValidationError[] {
      const errors: ValidationError[] = [];
      if (!contribution.id || contribution.id.trim() === '') {
        errors.push({ catalog: catalogName, id: contribution.id ?? '', message: 'ID is required' });
      }
      if (!contribution.label || contribution.label.trim() === '') {
        errors.push({ catalog: catalogName, id: contribution.id, message: 'Label is required' });
      }
      return errors;
    },

    validateCatalog(_contribution: Contribution<F>): ValidationError[] {
      // Override in subclasses for catalog-specific validation
      return [];
    },

    validateUnique(_catalog: string, id: string, existingCatalogs: Map<string, Catalog<any>>): ValidationError | null {
      // Check across all catalogs for global uniqueness
      for (const [catName, cat] of existingCatalogs) {
        if (cat.has(id)) {
          return {
            catalog: catName,
            id,
            message: `Duplicate ID "${id}" already registered in ${catName}`,
          };
        }
      }
      return null;
    },
  };
}

/** Validate a single contribution against its catalog. */
export function validateContribution<F extends Record<string, unknown>>(
  catalogName: string,
  contribution: Contribution<F>,
  validator: ContributionValidator<F>,
  catalogs: Map<string, Catalog<any>>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  errors.push(...validator.validateRequired(contribution));

  // Catalog-specific
  errors.push(...validator.validateCatalog(contribution));

  // Uniqueness across all catalogs
  const uniqueError = validator.validateUnique(catalogName, contribution.id, catalogs);
  if (uniqueError) errors.push(uniqueError);

  return errors;
}

/** Validate all contributions in all catalogs. */
export function validateAllCatalogs(catalogs: Map<string, Catalog<any>>): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [catalogName, catalog] of catalogs) {
    // We don't have a generic validator per catalog here, so just check uniqueness
    // and required fields for each entry
    for (const entry of catalog.entries) {
      // Entry has `label` from CatalogEntry
      if ('label' in entry && (!entry.label || entry.label.trim() === '')) {
        errors.push({ catalog: catalogName, id: String(entry.id ?? ''), message: 'Label is required' });
      }
      // Check uniqueness across catalogs
      for (const [otherName, otherCatalog] of catalogs) {
        if (otherName !== catalogName && otherCatalog.has(String(entry.id))) {
          errors.push({
            catalog: catalogName,
            id: String(entry.id),
            message: `Duplicate ID "${entry.id}" already registered in ${otherName}`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Throw on validation failure. */
export function assertValid(errors: ValidationError[], context?: string): void {
  if (errors.length > 0) {
    const messages = errors.map((e) => `${e.catalog}:${e.id} - ${e.message}`).join('\n');
    throw new Error(`Validation failed${context ? ` (${context})` : ''}\n${messages}`);
  }
}
