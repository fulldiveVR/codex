import type { ValidationResult, ValidationOptions, ValidationIssue } from './plugin-validation-types';

import { validateWithTsAST } from './ast-structure-validator';
import { ValidationSeverity } from './plugin-validation-types';
import { validateStructureWithRegex } from './structure-validator';
import { validateWithTsCompiler } from './ts-compiler-validator';

/**
 * Orchestrates the validation of generated plugin code.
 * Runs both TypeScript AST-based structure checks and TS compiler checks.
 *
 * @param pluginCode The string content of the generated plugin.
 * @param options Validation options (optional).
 * @returns Combined ValidationResult.
 */
export function validateGeneratedPluginCode(
    pluginCode: string,
    options?: ValidationOptions
): ValidationResult {
    // Basic check: Does it look like a code block?
    // Improve this heuristic as needed.
    const trimmedCode = pluginCode.trim();
    if (!trimmedCode.startsWith('import') && !trimmedCode.includes('defineApp')) {
        return {
            isValid: false,
            issues: [{
                severity: ValidationSeverity.ERROR,
                message: 'Output does not appear to be valid plugin code (missing imports or defineApp).',
                code: 'VALIDATION_NOT_CODE'
            }]
        };
    }

    // Run AST-based structure validation (preferred over regex for better accuracy)
    const structureResult = validateWithTsAST(pluginCode, options);

    // Run TypeScript compiler checks
    const compilerResult = validateWithTsCompiler(pluginCode);

    // Combine results
    const allIssues: Array<ValidationIssue> = [...structureResult.issues, ...compilerResult.issues];

    // Determine overall validity
    const overallIsValid = structureResult.isValid && compilerResult.isValid;

    return {
        isValid: overallIsValid,
        issues: allIssues,
        // Optionally add metadata like timing here
    };
}

/**
 * Validates code using the legacy regex structure validator for backwards compatibility.
 * 
 * @deprecated Use validateGeneratedPluginCode instead which uses AST-based validation.
 * @param pluginCode The string content of the generated plugin.
 * @returns Combined ValidationResult.
 */
export function validateWithRegex(
    pluginCode: string,
): ValidationResult {
    // Basic check: Does it look like a code block?
    const trimmedCode = pluginCode.trim();
    if (!trimmedCode.startsWith('import') && !trimmedCode.includes('defineApp')) {
        return {
            isValid: false,
            issues: [{
                severity: ValidationSeverity.ERROR,
                message: 'Output does not appear to be valid plugin code (missing imports or defineApp).',
                code: 'VALIDATION_NOT_CODE'
            }]
        };
    }

    // Run structural regex checks for backwards compatibility
    return validateStructureWithRegex(pluginCode);
}