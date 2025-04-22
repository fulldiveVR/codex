
import type { ValidationIssue, ValidationResult } from '../validation/plugin-validation-types';

import { ValidationSeverity } from '../validation/plugin-validation-types';

/**
 * Performs basic structural validation on plugin code using regular expressions.
 *
 * Checks for:
 * - Presence of `export default defineApp(...)`
 * - Basic import of `defineApp`
 * - Basic bracket/parenthesis balancing (heuristic)
 *
 * @param pluginCode The string content of the generated plugin.
 * @returns Partial ValidationResult focusing on structural issues.
 */
export function validateStructureWithRegex(pluginCode: string): Pick<ValidationResult, 'isValid' | 'issues'> {
    const issues: Array<ValidationIssue> = [];
    let isValid = true;

    // 1. Check for `export default defineApp(`
    if (!/export\s+default\s+defineApp\s*\(/.test(pluginCode)) {
        issues.push({
            severity: ValidationSeverity.ERROR,
            message: "Plugin code must include 'export default defineApp(...)'.",
            code: 'STRUCTURE_MISSING_DEFINEAPP_EXPORT',
        });
        isValid = false;
    }

    // 2. Check for basic `defineApp` import
    // This is a simple check and might miss complex import scenarios (e.g., aliasing)
    if (!/import\s+.*?defineApp.*?from\s+['"].*?['"]/.test(pluginCode)) {
         issues.push({
            severity: ValidationSeverity.WARNING, // Warning, as it might be aliased or imported differently
            message: "Could not find a standard import for 'defineApp'. Ensure it is correctly imported.",
            code: 'STRUCTURE_MISSING_DEFINEAPP_IMPORT',
        });
        // Not setting isValid = false for a warning
    }

    // 3. Basic bracket/parenthesis balancing (heuristic)
    const openBrackets = (pluginCode.match(/\{|\[|\(/g) || []).length;
    const closeBrackets = (pluginCode.match(/\}|\}|\]|\)/g) || []).length;
    if (openBrackets !== closeBrackets) {
        issues.push({
            severity: ValidationSeverity.WARNING, // Warning, as comments/strings can skew this
            message: `Potential bracket/parenthesis imbalance detected (Open: ${openBrackets}, Close: ${closeBrackets}). Review code carefully.`,
            code: 'STRUCTURE_BRACKET_IMBALANCE',
        });
         // Not setting isValid = false for a warning
    }

    // TODO: Add more regex checks as needed (e.g., presence of 'name', 'key' properties within defineApp)

    return { isValid, issues };
}