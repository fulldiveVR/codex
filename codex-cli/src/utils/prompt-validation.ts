/**
 * Utility functions for validating user prompts.
 */

/**
 * Keywords and phrases indicating a plugin creation request.
 * Matching is case-insensitive and requires whole words/phrases.
 */
const PLUGIN_CREATION_KEYWORDS = [
  /\bcreate plugin\b/i,
  /\bgenerate plugin\b/i,
  /\bbuild plugin\b/i,
  /\bmake plugin\b/i,
  /\bdevelop plugin\b/i,
  /\bwrite plugin\b/i,
  /\bplugin for\b/i, // e.g., "plugin for parsing json"
  /\bplugin that\b/i, // e.g., "plugin that converts markdown"
];

/**
 * Checks if a given prompt string indicates an intent to create a plugin.
 *
 * Validation Criteria (from Subtask 2.1):
 * 1. Keywords/Phrases (Case-Insensitive): Must contain one of the keywords.
 * 2. Contextual Relevance: Assumed if keywords are present (simple check).
 * 3. Exclusion Keywords: Not implemented in this basic version.
 * 4. Rules: Case-insensitive, whole words/phrases (handled by regex \b).
 * 5. Edge Cases:
 *    - Very short prompts likely won't match keywords.
 *    - Mixed requests might still match if keywords are present.
 *    - Questions *about* plugins might match if keywords are present (e.g., "how to create plugin").
 *
 * @param prompt The user input string.
 * @returns True if the prompt likely requests plugin creation, false otherwise.
 */
export function isPluginCreationPrompt(prompt: string): boolean {
  if (!prompt || prompt.trim().length < 10) {
    // Basic check for minimum length to avoid trivial matches
    return false;
  }

  // Check if any of the keywords/patterns match
  return PLUGIN_CREATION_KEYWORDS.some((pattern) => pattern.test(prompt));
}