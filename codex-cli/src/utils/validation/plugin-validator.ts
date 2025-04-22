import type { ValidationResult, ValidationOptions, ValidationIssue } from './plugin-validation-types';

// eslint-disable-next-line import/order
import { ValidationSeverity } from './plugin-validation-types';

// Separate type/value imports from other imports

import { validateStructureWithRegex } from './structure-validator';
import { validateWithTsCompiler } from './ts-compiler-validator';

/**
 * Orchestrates the validation of generated plugin code.
 * Runs both regex-based structural checks and TS compiler checks.
 *
 * @param pluginCode The string content of the generated plugin.
 * @param options Validation options (optional).
 * @returns Combined ValidationResult.
 */
export function validateGeneratedPluginCode(
    pluginCode: string,
    _options?: ValidationOptions
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

    // Run structural regex checks
    const structureResult = validateStructureWithRegex(pluginCode);

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