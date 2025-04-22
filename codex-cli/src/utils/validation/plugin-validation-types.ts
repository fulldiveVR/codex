/**
 * Severity levels for validation issues
 */
export enum ValidationSeverity {
  ERROR = 'error',       // Prevents plugin from functioning
  WARNING = 'warning',   // May cause issues but not critical
  SUGGESTION = 'suggestion' // Best practice recommendations
}

/**
 * Represents a single validation issue
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  location?: {
    line?: number;
    column?: number;
    filePath?: string;
  };
  code?: string; // Error code for reference
  suggestion?: string; // Optional fix suggestion
}

/**
 * Result of plugin validation
 */
export interface ValidationResult {
  isValid: boolean; // true if no ERROR severity issues
  issues: Array<ValidationIssue>; // Changed to Array<T>
  metadata?: {
    pluginName?: string;
    version?: string;
    timeToValidate?: number; // ms
  };
}

/**
 * Options for validation
 */
export interface ValidationOptions {
  strictMode?: boolean; // When true, warnings are treated as errors
  ignorePatterns?: Array<string>; // Changed to Array<T> // Glob patterns to ignore
  customRules?: Array<unknown>; // Use unknown instead of any for better type safety
}

/**
 * Plugin validator interface
 */
export interface IPluginValidator {
  validate(pluginCode: string, options?: ValidationOptions): ValidationResult;
  validateFile?(filePath: string, options?: ValidationOptions): Promise<ValidationResult>;
}