# Plugin Structure Validator - Architecture Design

This document outlines the architecture for the enhanced plugin structure validator which will check TypeScript plugin code snippets for required components and structural integrity.

## 1. Architecture Overview

The Plugin Structure Validator will be built using a combination of the TypeScript AST (Abstract Syntax Tree) for precise structural analysis and the existing validation infrastructure. The validator will focus on identifying required plugin components and ensuring their correct structure.

### High-level Components:

```
┌─────────────────────────┐
│ validateGeneratedPlugin │
│        (Main API)       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐     ┌───────────────────────┐
│ validatePluginStructure │────▶│  validateWithTsAST    │
└───────────┬─────────────┘     └───────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  validateWithTsCompiler │
└─────────────────────────┘
```

## 2. Key Components and Interfaces

### 2.1 Plugin Structure Validator Interface

```typescript
// Enhanced interface for plugin structure validation
interface IPluginStructureValidator {
  validateStructure(
    pluginCode: string,
    options?: ValidationOptions,
  ): ValidationResult;

  // Optional method to validate specific plugin components
  validateComponent?(
    componentName: string,
    componentCode: string,
    options?: ValidationOptions,
  ): ValidationResult;
}
```

### 2.2 Plugin Component Structure Definitions

```typescript
// Required components in a plugin
enum PluginComponent {
  DEFINE_APP = "defineApp",
  ACTIONS = "actions",
  AUTH = "auth",
  FIELDS = "fields",
}

// Structure definition for each component
interface ComponentStructure {
  required: boolean;
  requiredProperties: string[];
  validationRules: ValidationRule[];
}

// Mapping of component types to their structure requirements
const COMPONENT_STRUCTURES: Record<PluginComponent, ComponentStructure> = {
  [PluginComponent.DEFINE_APP]: {
    required: true,
    requiredProperties: ["name", "key", "auth", "actions"],
    validationRules: [
      /* rules for defineApp */
    ],
  },
  [PluginComponent.ACTIONS]: {
    required: true,
    requiredProperties: ["key", "name"],
    validationRules: [
      /* rules for actions */
    ],
  },
  // Additional components...
};
```

### 2.3 Validation Output Structure

We'll continue using the existing `ValidationResult` and `ValidationIssue` interfaces, with enhanced error reporting:

```typescript
// Enhanced validation issue with improved location data and suggestions
interface EnhancedValidationIssue extends ValidationIssue {
  component?: PluginComponent;
  codeSnippet?: string;
  expectedStructure?: string;
  documentationLink?: string;
}
```

## 3. Implementation Details

### 3.1 TypeScript AST-based Validation

Instead of using regex-based validation, we'll use TypeScript's AST to analyze the code structure:

```typescript
export function validateWithTsAST(
  pluginCode: string,
  options?: ValidationOptions,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Parse code to AST
  const sourceFile = ts.createSourceFile(
    "plugin.ts",
    pluginCode,
    ts.ScriptTarget.Latest,
    true,
  );

  // Find and validate defineApp export
  const defineAppNode = findDefineAppNode(sourceFile);
  if (!defineAppNode) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: "Missing defineApp export",
      code: "STRUCTURE_MISSING_DEFINEAPP",
    });
  } else {
    // Validate defineApp structure
    issues.push(...validateDefineAppStructure(defineAppNode));
  }

  // Validate actions
  const actionsNodes = findActionsNodes(sourceFile);
  if (actionsNodes.length === 0) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: "No actions defined in plugin",
      code: "STRUCTURE_NO_ACTIONS",
    });
  } else {
    // Validate each action structure
    for (const node of actionsNodes) {
      issues.push(...validateActionStructure(node));
    }
  }

  // Additional component validations...

  return {
    isValid: !issues.some(
      (issue) => issue.severity === ValidationSeverity.ERROR,
    ),
    issues,
  };
}
```

### 3.2 AST Traversal Helpers

We'll create helper functions to traverse the AST and locate key plugin components:

```typescript
// Find the defineApp export declaration
function findDefineAppNode(sourceFile: ts.SourceFile): ts.Node | undefined {
  // AST traversal to find defineApp node
}

// Find all action definitions
function findActionsNodes(sourceFile: ts.SourceFile): ts.Node[] {
  // AST traversal to find action nodes
}

// Extract properties from an object literal
function extractObjectProperties(
  node: ts.ObjectLiteralExpression,
): Record<string, ts.Expression> {
  // Extract properties from object literal
}
```

### 3.3 Component Structure Validation

For each component, we'll validate its structure against the defined requirements:

```typescript
// Validate defineApp structure
function validateDefineAppStructure(node: ts.Node): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for required properties
  const properties = extractObjectProperties(
    node as ts.ObjectLiteralExpression,
  );

  for (const requiredProp of COMPONENT_STRUCTURES.defineApp
    .requiredProperties) {
    if (!properties[requiredProp]) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Missing required property '${requiredProp}' in defineApp`,
        code: "STRUCTURE_MISSING_PROPERTY",
        location: getNodeLocation(node),
        component: PluginComponent.DEFINE_APP,
      });
    }
  }

  // Additional structure validations...

  return issues;
}
```

### 3.4 Line and Column Tracking

We'll implement precise line and column tracking using TypeScript's source position utilities:

```typescript
// Get location information from a node
function getNodeLocation(node: ts.Node): ValidationIssue["location"] {
  if (!node.getSourceFile()) return undefined;

  const start = node.getStart();
  const { line, character } = node
    .getSourceFile()
    .getLineAndCharacterOfPosition(start);

  return {
    line: line + 1, // Convert to 1-based indexing
    column: character + 1,
    // Extract the text of the node for context
    codeSnippet: node.getText().substring(0, 100) + "...",
  };
}
```

## 4. Integration with Existing Validation System

The enhanced plugin structure validator will be integrated with the existing validation system:

```typescript
export function validateGeneratedPluginCode(
  pluginCode: string,
  options?: ValidationOptions,
): ValidationResult {
  // Basic check if it looks like code
  // ...existing code...

  // Run AST-based structure validation (replacing regex-based checks)
  const structureResult = validateWithTsAST(pluginCode, options);

  // Run TypeScript compiler checks
  const compilerResult = validateWithTsCompiler(pluginCode);

  // Combine results
  const allIssues: Array<ValidationIssue> = [
    ...structureResult.issues,
    ...compilerResult.issues,
  ];

  return {
    isValid: structureResult.isValid && compilerResult.isValid,
    issues: allIssues,
  };
}
```

## 5. Error Reporting Enhancements

We'll enhance error reporting with more detailed information and suggestions:

```typescript
// Generate detailed suggestion for a missing component
function generateSuggestion(issue: ValidationIssue): string {
  if (issue.code === "STRUCTURE_MISSING_DEFINEAPP") {
    return `Add 'export default defineApp({ ... })' to your plugin`;
  }

  if (issue.code === "STRUCTURE_MISSING_PROPERTY" && issue.component) {
    const component = issue.component;
    const missingProp = issue.message?.match(/\'(.+?)\'/)![1];

    return `Add the '${missingProp}' property to your ${component} definition`;
  }

  // More suggestions...

  return "";
}
```

## 6. Plugin-Specific Validation Rules

We'll implement specific validation rules for the plugin structure:

### defineApp Component Rules:

- Must be exported as default
- Must include name, key, auth, and actions properties
- Must have proper typing (object literal with correct properties)

### Actions Component Rules:

- Each action must have a key and name
- Each action must have proper input or output definitions
- Action implementations must follow correct patterns

### Auth Component Rules:

- Must define authentication type
- Must include required fields for the selected auth type
- Must validate field structure (name, key, label, etc.)

## 7. Testing Strategy

We'll create comprehensive tests for the validator:

1. **Unit Tests**:

   - Test AST traversal functions in isolation
   - Test component validation functions with various inputs
   - Test error reporting and suggestion generation

2. **Integration Tests**:

   - Test complete validator with valid plugin examples
   - Test with plugins missing required components
   - Test with plugins containing malformed components

3. **Edge Cases**:
   - Test with empty input
   - Test with syntactically incorrect TypeScript
   - Test with partial plugin implementations

### Test Examples

```typescript
// Valid plugin test
test("validates a correctly structured plugin", () => {
  const validPlugin = `
    import { defineApp, defineAction } from '@codex/plugins';
    
    export default defineApp({
      name: 'Test Plugin',
      key: 'test-plugin',
      auth: { /* auth config */ },
      actions: [
        defineAction({
          name: 'Test Action',
          key: 'test-action',
          // ... other properties
        })
      ]
    });
  `;

  const result = validatePluginStructure(validPlugin);
  expect(result.isValid).toBe(true);
  expect(result.issues.length).toBe(0);
});

// Test missing component
test("detects missing actions component", () => {
  const invalidPlugin = `
    import { defineApp } from '@codex/plugins';
    
    export default defineApp({
      name: 'Test Plugin',
      key: 'test-plugin',
      auth: { /* auth config */ }
      // Missing actions array
    });
  `;

  const result = validatePluginStructure(invalidPlugin);
  expect(result.isValid).toBe(false);
  expect(
    result.issues.some((i) => i.code === "STRUCTURE_MISSING_PROPERTY"),
  ).toBe(true);
});
```
