
import type { ValidationIssue, ValidationResult } from '../validation/plugin-validation-types';

import { ValidationSeverity as ValidationSeverityEnum } from '../validation/plugin-validation-types'; // Import enum directly
import ts from 'typescript';

/**
 * Validates plugin code using the TypeScript compiler API.
 *
 * @param pluginCode The string content of the generated plugin.
 * @param tempFileName A temporary filename for the compiler (e.g., 'tempPlugin.ts').
 * @returns Partial ValidationResult focusing on compiler diagnostics.
 */
export function validateWithTsCompiler(
    pluginCode: string,
    tempFileName = 'tempPlugin.ts' // Provide a default filename
): Pick<ValidationResult, 'isValid' | 'issues'> {
    const issues: Array<ValidationIssue> = [];
    let isValid = true; // Assume valid until proven otherwise

    // Basic compiler options - adjust as needed for the target environment
    const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020, // Example target
        module: ts.ModuleKind.CommonJS, // Example module system
        strict: true,
        noEmit: true, // Don't generate output files
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        // Add any other relevant options (jsx, lib, paths, etc.)
    };

    // Create an in-memory source file
    const sourceFile = ts.createSourceFile(
        tempFileName,
        pluginCode,
        compilerOptions.target ?? ts.ScriptTarget.ESNext, // Use specified target or default
        true, // Set parent pointers
        ts.ScriptKind.TS // Specify the kind of file
    );

    // Create a Program
    // We need a host to resolve modules if the plugin has imports,
    // but for basic syntax/type check, a minimal host might suffice.
    // A more robust implementation might need a virtual file system.
    const host: ts.CompilerHost = {
        getSourceFile: (fileName) => fileName === tempFileName ? sourceFile : undefined,
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
        writeFile: () => { /* no-op */ },
        getCurrentDirectory: () => '/', // Use a fake root
        getDirectories: () => [],
        getCanonicalFileName: (fileName) => fileName,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
        fileExists: (fileName) => fileName === tempFileName,
        readFile: (fileName) => fileName === tempFileName ? pluginCode : undefined,
    };

    const program = ts.createProgram([tempFileName], compilerOptions, host);

    // Get diagnostics (syntax and semantic errors)
    const allDiagnostics = ts.getPreEmitDiagnostics(program);

    allDiagnostics.forEach((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        const severity = diagnostic.category === ts.DiagnosticCategory.Error
            ? ValidationSeverityEnum.ERROR
            : diagnostic.category === ts.DiagnosticCategory.Warning
                ? ValidationSeverityEnum.WARNING
                : ValidationSeverityEnum.SUGGESTION;

        if (severity === ValidationSeverityEnum.ERROR) {
            isValid = false;
        }

        let location: ValidationIssue['location'] = undefined;
        if (diagnostic.file && diagnostic.start !== undefined) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            location = {
                line: line + 1, // TS is 0-indexed, humans are 1-indexed
                column: character + 1,
                filePath: diagnostic.file.fileName, // Will be the tempFileName
            };
        }

        issues.push({
            severity,
            message,
            location,
            code: `TS${diagnostic.code}`,
        });
    });

    return { isValid, issues };
}