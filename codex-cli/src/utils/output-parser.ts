import * as prettier from 'prettier';

/**
 * Extracts the first TypeScript code block from a string.
 *
 * @param aiResponse The full response string from the AI.
 * @returns The content of the first TypeScript code block, or null if not found.
 */
export function extractPluginCode(aiResponse: string): string | null {
    // Regex to find a fenced code block optionally marked with 'typescript' or 'ts'
    const codeBlockRegex = /```(?:typescript|ts)?\r?\n([\s\S]*?)\r?\n```/;
    const match = aiResponse.match(codeBlockRegex);

    if (match && match[1]) {
        return match[1].trim();
    } else {
        // Fallback heuristic
        const trimmedResponse = aiResponse.trim();
        const looksLikeCode = (
            trimmedResponse.startsWith('import') ||
            trimmedResponse.startsWith('//') ||
            trimmedResponse.startsWith('const') ||
            trimmedResponse.startsWith('export') ||
            trimmedResponse.startsWith('interface') ||
            trimmedResponse.startsWith('type')
        ) &&
            trimmedResponse.includes('{') &&
            trimmedResponse.includes('}') &&
            trimmedResponse.includes(';');

        if (looksLikeCode) {
            return trimmedResponse;
        }
    }
    return null;
}

/**
 * Formats TypeScript code using Prettier.
 *
 * @param code The TypeScript code string to format.
 * @returns The formatted code string, or the original code if formatting fails.
 */
export async function formatPluginCode(code: string): Promise<string> {
    try {
        const options = await prettier.resolveConfig(process.cwd());
        const formattedCode = await prettier.format(code, {
            ...options,
            parser: 'typescript',
        });
        return formattedCode.trim();
    } catch (error) {
        // Return original code if formatting fails
        return `// Prettier formatting failed - Original code:\n${code}`;
    }
}