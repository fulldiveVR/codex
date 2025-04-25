import type { ValidationIssue, ValidationResult, ValidationOptions } from './plugin-validation-types';

import { ValidationSeverity } from './plugin-validation-types';
import * as ts from 'typescript';

/**
 * Enum defining plugin component types
 */
export enum PluginComponent {
  DEFINE_APP = 'defineApp',
  ACTIONS = 'actions',
  AUTH = 'auth',
  TRIGGERS = 'triggers',
  FIELDS = 'fields',
  DYNAMIC_FIELDS = 'dynamicFields',
  DYNAMIC_DATA = 'dynamicData',
}

/**
 * Enhanced validation issue with additional context
 */
export interface EnhancedValidationIssue extends ValidationIssue {
  component?: PluginComponent;
  codeSnippet?: string;
  expectedStructure?: string;
  documentationLink?: string;
  suggestion?: string;
}

/**
 * Structure definition for a plugin component
 */
interface ComponentStructure {
  required: boolean;
  requiredProperties: Array<string>;
  validationRules: Array<(node: ts.Node) => Array<ValidationIssue>>;
}

/**
 * Definitions of required component structures
 */
const COMPONENT_STRUCTURES: Record<PluginComponent, ComponentStructure> = {
  [PluginComponent.DEFINE_APP]: {
    required: true,
    requiredProperties: ['name', 'key', 'categories', 'iconUrl', 'authDocUrl', 'supportsConnections', 'apiBaseUrl'],
    validationRules: [
      createTypeValidator('name', 'string'),
      createTypeValidator('key', 'string'),
      createTypeValidator('categories', 'array'),
      createTypeValidator('iconUrl', 'string'),
      createTypeValidator('authDocUrl', 'string'),
      createTypeValidator('supportsConnections', 'boolean'),
      createTypeValidator('apiBaseUrl', 'string'),
      createTypeValidator('actions', 'array', ValidationSeverity.WARNING),
      createTypeValidator('description', 'string', ValidationSeverity.WARNING),
      createTypeValidator('dynamicData', 'array', ValidationSeverity.WARNING),
      createTypeValidator('dynamicFields', 'array', ValidationSeverity.WARNING),
      validatePluginStructure,
    ],
  },
  [PluginComponent.ACTIONS]: {
    required: false,
    requiredProperties: ['key', 'name', 'mode', 'description'],
    validationRules: [
      createTypeValidator('key', 'string'),
      createTypeValidator('name', 'string'),
      createTypeValidator('mode', 'string'),
      createTypeValidator('description', 'string'),
      createArrayItemsValidator('arguments', ['label', 'key', 'type', 'required'], ValidationSeverity.WARNING),
      validateActionImplementation,
    ],
  },
  [PluginComponent.AUTH]: {
    required: false, // Some plugins might not require auth
    requiredProperties: [''],
    validationRules: [
      createTypeValidator('type', 'string', ValidationSeverity.WARNING),
      createArrayItemsValidator('fields', ['key', 'label', 'type'], ValidationSeverity.WARNING),
      validateAuthFields,
    ],
  },
  [PluginComponent.TRIGGERS]: {
    required: false, // Triggers array is optional in defineApp
    requiredProperties: ['name', 'key', 'type', 'description'], // Required for each trigger object
    validationRules: [
      createTypeValidator('key', 'string'),
      createTypeValidator('name', 'string'),
      createTypeValidator('type', 'string'),
      createTypeValidator('mode', 'string'),
      createTypeValidator('description', 'string'),
      createArrayItemsValidator('arguments', ['label', 'key', 'type', 'required'], ValidationSeverity.WARNING),
      validateDependsOnProperty, // Check dependsOn within each trigger object
    ],
  },
  [PluginComponent.FIELDS]: {
    required: false,
    requiredProperties: ['key', 'label', 'type', 'required'],
    validationRules: [
      createTypeValidator('key', 'string'),
      createTypeValidator('label', 'string'),
      createTypeValidator('type', 'string'),
      createTypeValidator('required', 'boolean'),
      validateDependsOnProperty,
    ],
  },
  [PluginComponent.DYNAMIC_FIELDS]: {
    required: false,
    requiredProperties: ['name', 'key', 'run'],
    validationRules: [
      createTypeValidator('name', 'string'),
      createTypeValidator('key', 'string'),
      createTypeValidator('run', 'function'),
    ],
  },
  [PluginComponent.DYNAMIC_DATA]: {
    required: false,
    requiredProperties: ['name', 'key', 'run'],
    validationRules: [
      createTypeValidator('name', 'string'),
      createTypeValidator('key', 'string'),
      createTypeValidator('run', 'function'),
    ],
  },
};

/**
 * Validate plugin code structure using TypeScript's AST
 * 
 * @param pluginCode The plugin code to validate
 * @param _options Optional validation options
 * @returns Validation result
 */
export function validateWithTsAST(
  pluginCode: string,
  _options?: ValidationOptions
): ValidationResult {
  const issues: Array<EnhancedValidationIssue> = [];
  
  try {
    // Parse code to AST
    const sourceFile = ts.createSourceFile(
      'plugin.ts',
      pluginCode,
      ts.ScriptTarget.Latest,
      true
    );
    
    // Find and validate defineApp export
    const defineAppNode = findDefineAppNode(sourceFile);
    if (!defineAppNode) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: 'Missing defineApp export. Plugin must export a default defineApp expression.',
        code: 'STRUCTURE_MISSING_DEFINEAPP',
      });
    } else {
      // Validate defineApp structure
      issues.push(...validateDefineAppStructure(defineAppNode));
      
      // Get defineApp object
      const defineAppObject = getDefineAppObject(defineAppNode);
      if (defineAppObject) {
        // Validate actions
        const actionsProperty = findPropertyInObjectLiteral(defineAppObject, 'actions');
        if (actionsProperty) {
          issues.push(...validateActionsStructure(actionsProperty));
        }
        
        // Validate auth
        const authProperty = findPropertyInObjectLiteral(defineAppObject, 'auth');
        if (authProperty) {
          issues.push(...validateAuthStructure(authProperty));
        } else if (COMPONENT_STRUCTURES[PluginComponent.AUTH].required) {
          issues.push({
            severity: ValidationSeverity.ERROR,
            message: "Missing 'auth' property in defineApp. Authentication configuration is required.",
            code: 'STRUCTURE_MISSING_AUTH',
            location: {
              line: getLineNumber(defineAppObject),
              column: getColumnNumber(defineAppObject),
            },
          });
        }

        // Validate triggers
        const triggersProperty = findPropertyInObjectLiteral(defineAppObject, 'triggers');
        if (triggersProperty) {
          issues.push(...validateTriggersStructure(triggersProperty));
        }
        // Note: Triggers are often optional, so no error if missing unless specified

        // Validate dynamicFields
        const dynamicFieldsProperty = findPropertyInObjectLiteral(defineAppObject, 'dynamicFields');
        if (dynamicFieldsProperty) {
          // TODO: Implement validateDynamicFieldsStructure if needed
        }

        // Validate dynamicData
        const dynamicDataProperty = findPropertyInObjectLiteral(defineAppObject, 'dynamicData');
        if (dynamicDataProperty) {
          // TODO: Implement validateDynamicDataStructure if needed
        }
      }
    }
  } catch (error) {
    // Handle parsing errors
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: `Failed to parse plugin code: ${error instanceof Error ? error.message : String(error)}`,
      code: 'STRUCTURE_PARSE_ERROR',
    });
  }
  
  return {
    isValid: !issues.some(issue => issue.severity === ValidationSeverity.ERROR),
    issues,
  };
}

/**
 * Find the defineApp export in the source file
 */
function findDefineAppNode(sourceFile: ts.SourceFile): ts.CallExpression | undefined {
  let result: ts.CallExpression | undefined;
  
  // Visit each node to find export default defineApp
  const visit = (node: ts.Node) => {
    // Look for export default statements
    if (ts.isExportAssignment(node) && node.isExportEquals === false) {
      // It's an 'export default' statement
      const expression = node.expression;
      
      // Check if it's a call to defineApp
      if (ts.isCallExpression(expression) && 
          ts.isIdentifier(expression.expression) && 
          expression.expression.text === 'defineApp') {
        result = expression;
        return;
      }
    }
    
    ts.forEachChild(node, visit);
  };
  
  visit(sourceFile);
  return result;
}

/**
 * Get the object literal passed to defineApp
 */
function getDefineAppObject(defineAppNode: ts.CallExpression): ts.ObjectLiteralExpression | undefined {
  if (defineAppNode.arguments.length > 0) {
    const firstArg = defineAppNode.arguments[0];
    if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
      return firstArg;
    }
  }
  return undefined;
}

/**
 * Find a property in an object literal by name
 */
function findPropertyInObjectLiteral(
  objLiteral: ts.ObjectLiteralExpression,
  propertyName: string
): ts.PropertyAssignment | undefined {
  for (const property of objLiteral.properties) {
    if (ts.isPropertyAssignment(property)) {
      const name = property.name;
      if ((ts.isIdentifier(name) && name.text === propertyName) ||
          (ts.isStringLiteral(name) && name.text === propertyName)) {
        return property;
      }
    }
  }
  return undefined;
}

/**
 * Extract properties from an object literal as a record
 */
function extractObjectProperties(
  objLiteral: ts.ObjectLiteralExpression
): Record<string, ts.Expression> {
  const properties: Record<string, ts.Expression> = {};
  
  for (const property of objLiteral.properties) {
    if (ts.isPropertyAssignment(property)) {
      const name = property.name;
      if (ts.isIdentifier(name)) {
        properties[name.text] = property.initializer;
      } else if (ts.isStringLiteral(name)) {
        properties[name.text] = property.initializer;
      }
    }
  }
  
  return properties;
}

/**
 * Get the line and column for a node, or default to position 0,0
 */
function getNodePosition(node: ts.Node | undefined): { line: number, column: number } {
  if (!node || !node.getSourceFile()) {
    return { line: 0, column: 0 };
  }
  
  const start = node.getStart();
  const { line, character } = node.getSourceFile().getLineAndCharacterOfPosition(start);
  
  return {
    line: line + 1, // Convert to 1-based line numbers
    column: character + 1, // Convert to 1-based column numbers
  };
}

/**
 * Validate the structure of a defineApp node
 */
function validateDefineAppStructure(defineAppNode: ts.CallExpression): Array<EnhancedValidationIssue> {
  const issues: Array<EnhancedValidationIssue> = [];
  
  // Check if there are arguments
  if (defineAppNode.arguments.length === 0) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: 'defineApp called without arguments. It requires an object with configuration.',
      code: 'STRUCTURE_DEFINEAPP_NO_ARGS',
      location: {
        line: getNodePosition(defineAppNode).line,
        column: getNodePosition(defineAppNode).column,
      },
    });
    return issues;
  }
  
  // Get the object literal passed to defineApp
  const defineAppObject = getDefineAppObject(defineAppNode);
  if (!defineAppObject) {
    const argPos = getNodePosition(defineAppNode.arguments[0]);
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: 'defineApp must be called with an object literal containing configuration.',
      code: 'STRUCTURE_DEFINEAPP_NOT_OBJECT',
      location: {
        line: argPos.line,
        column: argPos.column,
      },
    });
    return issues;
  }
  
  // Get properties from object literal
  const properties = extractObjectProperties(defineAppObject);
  
  // Check for required properties
  for (const requiredProp of COMPONENT_STRUCTURES[PluginComponent.DEFINE_APP].requiredProperties) {
    if (!properties[requiredProp]) {
      const objPos = getNodePosition(defineAppObject);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Missing required property '${requiredProp}' in defineApp configuration.`,
        code: 'STRUCTURE_MISSING_PROPERTY',
        location: {
          line: objPos.line,
          column: objPos.column,
        },
        component: PluginComponent.DEFINE_APP,
        suggestion: `Add the '${requiredProp}' property to your defineApp configuration.`,
      });
    }
  }
  
  // Apply all validation rules for defineApp
  for (const rule of COMPONENT_STRUCTURES[PluginComponent.DEFINE_APP].validationRules) {
    issues.push(...rule(defineAppObject));
  }
  
  // Check for duplicate keys
  if (properties['key'] && ts.isStringLiteral(properties['key'])) {
    const keyValue = properties['key'].text;
    if (keyValue.includes(' ')) {
      const keyPos = getNodePosition(properties['key']);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: "The 'key' property cannot contain spaces.",
        code: 'STRUCTURE_INVALID_KEY',
        location: {
          line: keyPos.line,
          column: keyPos.column,
        },
        component: PluginComponent.DEFINE_APP,
        suggestion: `Replace spaces with dashes or underscores: '${keyValue.replace(/\s+/g, '-')}'`,
      });
    }
  }
  
  // Validate dependsOn property if present
  issues.push(...validateDependsOnProperty(defineAppObject));
  
  return issues;
}

/**
 * Validate the structure of actions property
 */
function validateActionsStructure(actionsProperty: ts.PropertyAssignment): Array<EnhancedValidationIssue> {
  const issues: Array<EnhancedValidationIssue> = [];
  const value = actionsProperty.initializer;
  
  // Actions should be an array
  if (!ts.isArrayLiteralExpression(value)) {
    const propPos = getNodePosition(actionsProperty);
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: "The 'actions' property must be an array.",
      code: 'STRUCTURE_ACTIONS_NOT_ARRAY',
      location: {
        line: propPos.line,
        column: propPos.column,
      },
      component: PluginComponent.ACTIONS,
    });
    return issues;
  }
  
  // If it's an empty array, add a warning
  if (value.elements.length === 0) {
    const arrayPos = getNodePosition(value);
    issues.push({
      severity: ValidationSeverity.WARNING,
      message: "The 'actions' array is empty. Plugin should define at least one action.",
      code: 'STRUCTURE_ACTIONS_EMPTY',
      location: {
        line: arrayPos.line,
        column: arrayPos.column,
      },
      component: PluginComponent.ACTIONS,
    });
    return issues;
  }
  
  // Validate each action in the array
  for (let i = 0; i < value.elements.length; i++) {
    const action = value.elements[i];
    
    // Actions should be defined using defineAction or as object literals
    if (action && ts.isCallExpression(action) && 
        ts.isIdentifier(action.expression) && 
        action.expression.text === 'defineAction') {
      // Check if defineAction was called with arguments
      if (action.arguments.length === 0) {
        const actionPos = getNodePosition(action);
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Action at index ${i} is missing configuration. defineAction requires an object argument.`,
          code: 'STRUCTURE_ACTION_NO_ARGS',
          location: {
            line: actionPos.line,
            column: actionPos.column,
          },
          component: PluginComponent.ACTIONS,
        });
        continue;
      }
      
      // Get the action configuration object
      const actionArg = action.arguments[0];
      if (actionArg && !ts.isObjectLiteralExpression(actionArg)) {
        const argPos = getNodePosition(actionArg);
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Action at index ${i} must be configured with an object literal.`,
          code: 'STRUCTURE_ACTION_NOT_OBJECT',
          location: {
            line: argPos.line,
            column: argPos.column,
          },
          component: PluginComponent.ACTIONS,
        });
        continue;
      }
      
      // Validate action properties if actionArg exists and is an object literal
      if (actionArg && ts.isObjectLiteralExpression(actionArg)) {
        issues.push(...validateActionProperties(actionArg, i));
      }
    } else if (action && ts.isObjectLiteralExpression(action)) {
      // If it's a direct object literal, validate its properties
      issues.push(...validateActionProperties(action, i));
    } else {
      const actionPos = getNodePosition(action);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Action at index ${i} must be defined using defineAction or as an object literal.`,
        code: 'STRUCTURE_INVALID_ACTION_DEFINITION',
        location: {
          line: actionPos.line,
          column: actionPos.column,
        },
        component: PluginComponent.ACTIONS,
      });
    }
  }
  
  // Validate dependsOn property if present
  // Only validate dependsOn on node types that can have this property (object literals)
  if (value && ts.isObjectLiteralExpression(value)) {
    issues.push(...validateDependsOnProperty(value));
  }
  
  return issues;
}

/**
 * Validate the properties of an action object
 */
function validateActionProperties(actionObj: ts.ObjectLiteralExpression, index: number): Array<EnhancedValidationIssue> {
  const issues: Array<EnhancedValidationIssue> = [];
  const properties = extractObjectProperties(actionObj);
  
  // Check for required properties
  for (const requiredProp of COMPONENT_STRUCTURES[PluginComponent.ACTIONS].requiredProperties) {
    if (!properties[requiredProp]) {
      const objPos = getNodePosition(actionObj);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Action at index ${index} is missing required property '${requiredProp}'.`,
        code: 'STRUCTURE_ACTION_MISSING_PROPERTY',
        location: {
          line: objPos.line,
          column: objPos.column,
        },
        component: PluginComponent.ACTIONS,
        suggestion: `Add the '${requiredProp}' property to your action definition.`,
      });
    }
  }
  
  // Check for proper implementation property
  if (!properties['run'] && !properties['handler']) {
    const objPos = getNodePosition(actionObj);
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: `Action at index ${index} must have either a 'run' or 'handler' implementation function.`,
      code: 'STRUCTURE_ACTION_MISSING_IMPLEMENTATION',
      location: {
        line: objPos.line,
        column: objPos.column,
      },
      component: PluginComponent.ACTIONS,
      suggestion: "Add a 'run' function to implement your action's behavior.",
    });
  }
  
  // Apply all validation rules for actions
  for (const rule of COMPONENT_STRUCTURES[PluginComponent.ACTIONS].validationRules) {
    issues.push(...rule(actionObj));
  }
  
  // Check for invalid key format
  if (properties['key'] && ts.isStringLiteral(properties['key'])) {
    const keyValue = properties['key'].text;
    
    if (keyValue.includes(' ')) {
      const keyPos = getNodePosition(properties['key']);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: "Action 'key' property cannot contain spaces.",
        code: 'STRUCTURE_INVALID_ACTION_KEY',
        location: {
          line: keyPos.line,
          column: keyPos.column,
        },
        component: PluginComponent.ACTIONS,
        suggestion: `Replace spaces with dashes or underscores: '${keyValue.replace(/\s+/g, '-')}'`,
      });
    }
  }
  
  // Validate dependsOn property if present
  issues.push(...validateDependsOnProperty(actionObj as ts.ObjectLiteralExpression));
  
  return issues;
}

/**
 * Validate the structure of auth property
 */
function validateAuthStructure(authProperty: ts.PropertyAssignment): Array<EnhancedValidationIssue> {
  const issues: Array<EnhancedValidationIssue> = [];
  const value = authProperty.initializer;
  
  // Auth should be an object
  if (!ts.isObjectLiteralExpression(value)) {
    const propPos = getNodePosition(authProperty);
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: "The 'auth' property must be an object literal.",
      code: 'STRUCTURE_AUTH_NOT_OBJECT',
      location: {
        line: propPos.line,
        column: propPos.column,
      },
      component: PluginComponent.AUTH,
    });
    return issues;
  }
  
  // Get properties from object literal
  const properties = extractObjectProperties(value);
  
  // Check for required properties
  for (const requiredProp of COMPONENT_STRUCTURES[PluginComponent.AUTH].requiredProperties) {
    if (!properties[requiredProp]) {
      const valuePos = getNodePosition(value);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Missing required property '${requiredProp}' in auth configuration.`,
        code: 'STRUCTURE_AUTH_MISSING_PROPERTY',
        location: {
          line: valuePos.line,
          column: valuePos.column,
        },
        component: PluginComponent.AUTH,
        suggestion: `Add the '${requiredProp}' property to your auth configuration.`,
      });
    }
  }
  
  // If type is specified, validate based on auth type
  if (properties['type'] && ts.isStringLiteral(properties['type'])) {
    const authType = properties['type'].text;
    // Validate specific auth types
    issues.push(...validateAuthType(authType, value));
  }
  
  // Validate dependsOn property if present
  // Only validate dependsOn on node types that can have this property (object literals)
  if (value && ts.isObjectLiteralExpression(value)) {
    issues.push(...validateDependsOnProperty(value));
  }
  
  return issues;
}

/**
 * Validate the auth type specific structure
 */
function validateAuthType(authType: string, authObj: ts.ObjectLiteralExpression): Array<EnhancedValidationIssue> {
  const issues: Array<EnhancedValidationIssue> = [];
  const properties = extractObjectProperties(authObj);
  const objPos = getNodePosition(authObj);

  // Helper to check for required properties for a given type
  const checkRequiredProps = (requiredProps: Array<string>, codePrefix: string) => {
    for (const prop of requiredProps) {
      if (!properties[prop]) {
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `'${authType}' authentication requires a '${prop}' property.`,
          code: `STRUCTURE_${codePrefix}_MISSING_PROPERTY`,
          location: { line: objPos.line, column: objPos.column },
          component: PluginComponent.AUTH,
        });
      }
    }
  };

  // Helper to validate the 'fields' array if present
  const validateFieldsArray = () => {
    if (properties['fields'] && !ts.isArrayLiteralExpression(properties['fields'])) {
      const fieldsPos = getNodePosition(properties['fields']);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: "The 'fields' property, if present, must be an array.",
        code: 'STRUCTURE_AUTH_FIELDS_NOT_ARRAY',
        location: { line: fieldsPos.line, column: fieldsPos.column },
        component: PluginComponent.AUTH,
      });
    } else if (properties['fields'] && ts.isArrayLiteralExpression(properties['fields'])) {
      // Optionally add more specific validation for fields here
      // e.g., check if each field has required properties like key, label, type
      issues.push(...createArrayItemsValidator('fields', ['key', 'label', 'type'], ValidationSeverity.WARNING)(authObj));
    }
  };

  switch (authType.toLowerCase()) { // Use lowerCase for robustness
    case 'manual': // Renamed from api_key for clarity, covers general field-based auth
      // Manual/API Key auth typically relies on the 'fields' array for configuration.
      // It MUST have a 'fields' array.
      if (!properties['fields'] || !ts.isArrayLiteralExpression(properties['fields'])) {
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `'${authType}' authentication requires a 'fields' array property defining the required inputs.`,
          code: 'STRUCTURE_MANUAL_MISSING_FIELDS',
          location: { line: objPos.line, column: objPos.column },
          component: PluginComponent.AUTH,
          suggestion: "Add a 'fields' array with objects defining 'key', 'label', and 'type' for each required input.",
        });
      } else if ((properties['fields'] as ts.ArrayLiteralExpression).elements.length === 0) {
        const fieldsPos = getNodePosition(properties['fields']);
         issues.push({
            severity: ValidationSeverity.ERROR,
            message: `The 'fields' array for '${authType}' authentication cannot be empty.`,
            code: 'STRUCTURE_MANUAL_EMPTY_FIELDS',
            location: { line: fieldsPos.line, column: fieldsPos.column },
            component: PluginComponent.AUTH,
          });
      } else {
         // Validate the structure of items within the fields array
         validateFieldsArray();
      }
      // It also requires verifyCredentials and isStillVerified functions
      checkRequiredProps(['verifyCredentials', 'isStillVerified'], 'MANUAL');
      break;

    case 'oauth':
    {
      // OAuth requires specific top-level properties and a specific field definition.
      const requiredTopLevelProps = ['type', 'fields', 'verifyCredentials', 'isStillVerified'];
      checkRequiredProps(requiredTopLevelProps, 'OAUTH');

      // OAuth also requires verifyCredentials and isStillVerified
      // Handled by the checkRequiredProps above.

      // It MUST have a 'fields' array containing exactly one field: the 'oAuthRedirectUrl' definition.

      // Validate the 'fields' array structure and content
      const fieldsProp = properties['fields'];

      if (fieldsProp && ts.isArrayLiteralExpression(fieldsProp)) {
        const fieldsArray = fieldsProp as ts.ArrayLiteralExpression;

        // 1. Check for exactly one element
        if (fieldsArray.elements.length !== 1) {
          const fieldsPos = getNodePosition(fieldsArray);
          issues.push({
            severity: ValidationSeverity.ERROR,
            message: `OAuth authentication requires the 'fields' array to contain exactly one item (the 'oAuthRedirectUrl' definition).`,
            code: 'STRUCTURE_OAUTH_INVALID_FIELD_COUNT',
            location: { line: fieldsPos.line, column: fieldsPos.column },
            component: PluginComponent.AUTH,
          });
        } else {
          // 2. Validate the single field definition
          const fieldElement = fieldsArray.elements[0];
          if (fieldElement && ts.isObjectLiteralExpression(fieldElement)) {
            const fieldProps = extractObjectProperties(fieldElement);
            const keyProp = fieldProps['key'];

            // Check if the key is 'oAuthRedirectUrl'
            if (!keyProp || !ts.isStringLiteral(keyProp) || keyProp.text !== 'oAuthRedirectUrl') {
              const keyPos = keyProp ? getNodePosition(keyProp) : getNodePosition(fieldElement);
              issues.push({
                severity: ValidationSeverity.ERROR,
                message: `The single field in the 'fields' array for OAuth authentication must have the key 'oAuthRedirectUrl'.`,
                code: 'STRUCTURE_OAUTH_INVALID_FIELD_KEY',
                location: { line: keyPos.line, column: keyPos.column },
                component: PluginComponent.AUTH,
              });
            }
            // Note: We are only checking the key as per the request. Full validation could be added here.

          } else {
            // If the single element is not an object literal
            const fieldPos = getNodePosition(fieldElement);
            issues.push({
              severity: ValidationSeverity.ERROR,
              message: `The item in the 'fields' array for OAuth authentication must be an object literal.`,
              code: 'STRUCTURE_OAUTH_FIELD_NOT_OBJECT',
              location: { line: fieldPos.line, column: fieldPos.column },
              component: PluginComponent.AUTH,
            });
          }
        }
      } else if (fieldsProp === undefined) {
        // If 'fields' is entirely missing, we need to report that (unless it's optional for OAuth)
        // Assuming 'fields' is required for OAuth to contain the redirect URL field:
        issues.push({
            severity: ValidationSeverity.ERROR,
            message: `OAuth authentication requires a 'fields' array containing the 'oAuthRedirectUrl' field definition.`,
            code: 'STRUCTURE_OAUTH_MISSING_FIELDS_ARRAY',
            location: { line: objPos.line, column: objPos.column }, // Position of the auth object
            component: PluginComponent.AUTH,
          });
      } else {
        // If fieldsProp exists but is not an array
        const fieldsPos = getNodePosition(properties['fields']);
         issues.push({
            severity: ValidationSeverity.ERROR,
            message: `The 'fields' property for OAuth authentication must be an array.`,
            code: 'STRUCTURE_OAUTH_FIELDS_NOT_ARRAY',
            location: { line: fieldsPos.line, column: fieldsPos.column },
            component: PluginComponent.AUTH,
          });
      }
      break;
    }

    case 'cookies':
    {
      // Cookies auth requires a specific structure
      const requiredTopLevelProps = ['type', 'fields', 'verifyCredentials', 'isStillVerified'];
      checkRequiredProps(requiredTopLevelProps, 'COOKIE');

      // Ensure fields array is present and not empty for credentials
      const fieldsProp = properties['fields'];
      if (fieldsProp && ts.isArrayLiteralExpression(fieldsProp)) {
        const fieldsArray = fieldsProp as ts.ArrayLiteralExpression;

        // 1. Check for exactly one element in the fields array
        if (fieldsArray.elements.length !== 1) {
          const fieldsPos = getNodePosition(fieldsArray);
          issues.push({
            severity: ValidationSeverity.ERROR,
            message: `'cookies' authentication requires the 'fields' array to contain exactly one field definition.`,
            code: 'STRUCTURE_COOKIE_INVALID_FIELD_COUNT',
            location: { line: fieldsPos.line, column: fieldsPos.column },
            component: PluginComponent.AUTH,
          });
        } else {
          // 2. Validate the structure of that single field definition
          const fieldDef = fieldsArray.elements[0];
          if (fieldDef && ts.isObjectLiteralExpression(fieldDef)) {
            const fieldProps = extractObjectProperties(fieldDef);
            const fieldPos = getNodePosition(fieldDef);
            const expectedFieldProps = ['key', 'label', 'type', 'required', 'readOnly', 'clickToCopy'];

            // Check presence of all expected properties
            for (const prop of expectedFieldProps) {
              if (!fieldProps[prop]) {
                issues.push({
                  severity: ValidationSeverity.ERROR,
                  message: `The field definition in 'cookies' auth is missing the required property '${prop}'.`,
                  code: 'STRUCTURE_COOKIE_FIELD_MISSING_PROP',
                  location: { line: fieldPos.line, column: fieldPos.column },
                  component: PluginComponent.AUTH,
                });
              }
            }

            // Check specific values for certain properties
            const checkFieldValue = (propName: string, expectedKind: ts.SyntaxKind, expectedValue: string | boolean, code: string) => {
              const propNode = fieldProps[propName];
              if (propNode && propNode.kind !== expectedKind) {
                 const propPos = getNodePosition(propNode);
                  issues.push({
                    severity: ValidationSeverity.ERROR,
                    message: `Property '${propName}' in the 'cookies' field definition must be '${expectedValue}'.`,
                    code: code,
                    location: { line: propPos.line, column: propPos.column },
                    component: PluginComponent.AUTH,
                  });
              } else if (propNode && ts.isStringLiteral(propNode) && propNode.text !== expectedValue) {
                  // Extra check for string literals in case kind matches but text doesn't (though unlikely for 'string')
                  const propPos = getNodePosition(propNode);
                  issues.push({
                    severity: ValidationSeverity.ERROR,
                    message: `Property '${propName}' in the 'cookies' field definition must have the value "${expectedValue}". Found "${propNode.text}".`,
                    code: code,
                    location: { line: propPos.line, column: propPos.column },
                    component: PluginComponent.AUTH,
                  });
              }
            };

            checkFieldValue('type', ts.SyntaxKind.StringLiteral, 'string', 'STRUCTURE_COOKIE_FIELD_INVALID_TYPE');
            checkFieldValue('required', ts.SyntaxKind.TrueKeyword, true, 'STRUCTURE_COOKIE_FIELD_INVALID_REQUIRED');
            checkFieldValue('readOnly', ts.SyntaxKind.TrueKeyword, true, 'STRUCTURE_COOKIE_FIELD_INVALID_READONLY');
            checkFieldValue('clickToCopy', ts.SyntaxKind.FalseKeyword, false, 'STRUCTURE_COOKIE_FIELD_INVALID_CLICKTOCOPY');

          } else {
            const fieldPos = getNodePosition(fieldDef);
            issues.push({
              severity: ValidationSeverity.ERROR,
              message: `The element in the 'fields' array for 'cookies' auth must be an object literal.`,
              code: 'STRUCTURE_COOKIE_FIELD_NOT_OBJECT',
              location: { line: fieldPos.line, column: fieldPos.column },
              component: PluginComponent.AUTH,
            });
          }
        }
      } else if (fieldsProp === undefined) {
         // This case is handled by checkRequiredProps checking for 'fields' existence.
         // If we reach here and fieldsProp is undefined, it means checkRequiredProps already added an error.
      } else {
         // If fieldsProp exists but is not an array
          const fieldsPos = getNodePosition(properties['fields']);
         issues.push({
            severity: ValidationSeverity.ERROR,
            message: `The 'fields' property for 'cookies' authentication must be an array.`,
            code: 'STRUCTURE_COOKIE_FIELDS_NOT_ARRAY',
            location: { line: fieldsPos.line, column: fieldsPos.column },
            component: PluginComponent.AUTH,
          });
      }
      break;
    }

    default:
    {
      // For unknown auth types, add a warning
      if (properties['type']) {
        const typeNode = properties['type'] as ts.Node;
        const typePos = getNodePosition(typeNode);
        issues.push({
          severity: ValidationSeverity.WARNING,
          message: `Unknown or unsupported authentication type '${authType}'. Supported types are 'manual', 'oauth', 'cookies'.`,
          code: 'STRUCTURE_UNKNOWN_AUTH_TYPE',
          location: { line: typePos.line, column: typePos.column },
          component: PluginComponent.AUTH,
        });
      }
      break;
    }
  }

  // Validate dependsOn property if present (moved from validateAuthStructure)
  // issues.push(...validateDependsOnProperty(authObj)); // Keep dependsOn validation separate if needed elsewhere

  return issues;
}

/**
 * Get the line number of a node
 */
function getLineNumber(node: ts.Node): number {
  return getNodePosition(node).line;
}

/**
 * Get the column number of a node
 */
function getColumnNumber(node: ts.Node): number {
  return getNodePosition(node).column;
}

/**
 * Generate suggestions for common validation issues
 */
export function generateSuggestion(issue: ValidationIssue): string {
  if ((issue as EnhancedValidationIssue).suggestion) {return (issue as EnhancedValidationIssue).suggestion || '';}
  
  // Generate suggestions based on error code
  switch (issue.code) {
    case 'STRUCTURE_MISSING_DEFINEAPP':
      return `Add 'export default defineApp({ ... })' to your plugin`;
      
    case 'STRUCTURE_MISSING_PROPERTY':
      if ((issue as EnhancedValidationIssue).component) {
        const component = (issue as EnhancedValidationIssue).component;
        const match = issue.message?.match(/'(.+?)'/) || [null, 'unknown'];
        const missingProp = match[1];
        return `Add the '${missingProp}' property to your ${component} definition`;
      }
      break;
      
    case 'STRUCTURE_DEFINEAPP_NO_ARGS':
      return `Change to 'export default defineApp({ name: "Your Plugin", key: "your-plugin", actions: [] })'`;
      
    case 'STRUCTURE_ACTIONS_EMPTY':
      return `Add at least one action to the actions array: actions: [defineAction({ name: "Example", key: "example", run: () => {} })]`;
      
    case 'STRUCTURE_ACTION_MISSING_IMPLEMENTATION':
      return `Add a run function to implement your action: run: async ({ auth }) => { return { data: {} }; }`;
      
    // Add more suggestions based on other error codes
      
    default:
      return '';
  }
  
  return '';
}

// Add additional validation rules to COMPONENT_STRUCTURES

// First, let's define some validation rule functions
/**
 * Validates that a property is of a specific type
 */
function createTypeValidator(
  propName: string, 
  expectedType: 'string' | 'array' | 'object' | 'function' | 'boolean', 
  severity: ValidationSeverity = ValidationSeverity.ERROR
): (node: ts.Node) => Array<ValidationIssue> {
  return (node: ts.Node): Array<ValidationIssue> => {
    if (!ts.isObjectLiteralExpression(node)) {return [];}
    
    const properties = extractObjectProperties(node);
    const property = properties[propName];
    
    if (!property) {return [];} // Property not found, but this is handled by requiredProperties check
    
    const issues: Array<ValidationIssue> = [];
    
    switch (expectedType) {
      case 'string':
        if (!ts.isStringLiteral(property) && !ts.isNoSubstitutionTemplateLiteral(property)) {
          const pos = getNodePosition(property);
          issues.push({
            severity,
            message: `Property '${propName}' must be a string.`,
            code: 'STRUCTURE_INVALID_TYPE',
            location: {
              line: pos.line,
              column: pos.column,
            },
            component: getComponentForNode(node),
            suggestion: `Change '${propName}' to a string value, e.g., "${propName}": "value"`,
          } as EnhancedValidationIssue);
        }
        break;
        
      case 'array':
        if (!ts.isArrayLiteralExpression(property)) {
          const pos = getNodePosition(property);
          issues.push({
            severity,
            message: `Property '${propName}' must be an array.`,
            code: 'STRUCTURE_INVALID_TYPE',
            location: {
              line: pos.line,
              column: pos.column,
            },
            component: getComponentForNode(node),
            suggestion: `Change '${propName}' to an array, e.g., "${propName}": []`,
          } as EnhancedValidationIssue);
        }
        break;
        
      case 'object':
        if (!ts.isObjectLiteralExpression(property)) {
          const pos = getNodePosition(property);
          issues.push({
            severity,
            message: `Property '${propName}' must be an object.`,
            code: 'STRUCTURE_INVALID_TYPE',
            location: {
              line: pos.line,
              column: pos.column,
            },
            component: getComponentForNode(node),
            suggestion: `Change '${propName}' to an object, e.g., "${propName}": {}`,
          } as EnhancedValidationIssue);
        }
        break;
        
      case 'function':
        if (!ts.isArrowFunction(property) && 
            !ts.isFunctionExpression(property) && 
            !ts.isFunctionDeclaration(property)) {
          const pos = getNodePosition(property);
          issues.push({
            severity,
            message: `Property '${propName}' must be a function.`,
            code: 'STRUCTURE_INVALID_TYPE',
            location: {
              line: pos.line,
              column: pos.column,
            },
            component: getComponentForNode(node),
            suggestion: `Change '${propName}' to a function, e.g., "${propName}": () => {}`,
          } as EnhancedValidationIssue);
        }
        break;
        
      case 'boolean': {
        if (property.kind !== ts.SyntaxKind.TrueKeyword && property.kind !== ts.SyntaxKind.FalseKeyword) {
          const pos = getNodePosition(property);
          issues.push({
            severity,
            message: `Property '${propName}' must be a boolean.`,
            code: 'STRUCTURE_INVALID_TYPE',
            location: {
              line: pos.line,
              column: pos.column,
            },
            component: getComponentForNode(node),
            suggestion: `Change '${propName}' to a boolean, e.g., "${propName}": true or "${propName}": false`,
          } as EnhancedValidationIssue);
        }
        break;
      }
    }
    
    return issues;
  };
}

/**
 * Validates that all items in an array have certain required properties
 */
function createArrayItemsValidator(
  arrayPropName: string, 
  requiredItemProps: Array<string>,
  severity: ValidationSeverity = ValidationSeverity.ERROR
): (node: ts.Node) => Array<ValidationIssue> {
  return (node: ts.Node): Array<ValidationIssue> => {
    if (!ts.isObjectLiteralExpression(node)) {return [];}
    
    const properties = extractObjectProperties(node);
    const arrayProp = properties[arrayPropName];
    
    if (!arrayProp || !ts.isArrayLiteralExpression(arrayProp)) {return [];}
    
    const issues: Array<ValidationIssue> = [];
    
    // Check each item in the array
    arrayProp.elements.forEach((element, index) => {
      if (!ts.isObjectLiteralExpression(element)) {
        const pos = getNodePosition(element);
        issues.push({
          severity,
          message: `Item ${index} in '${arrayPropName}' must be an object.`,
          code: 'STRUCTURE_INVALID_ARRAY_ITEM',
          location: {
            line: pos.line,
            column: pos.column,
          },
          component: getComponentForNode(node),
        } as EnhancedValidationIssue);
        return;
      }
      
      // Check for required properties in each item
      const itemProperties = extractObjectProperties(element);
      for (const requiredProp of requiredItemProps) {
        if (!itemProperties[requiredProp]) {
          const pos = getNodePosition(element);
          issues.push({
            severity,
            message: `Item ${index} in '${arrayPropName}' is missing required property '${requiredProp}'.`,
            code: 'STRUCTURE_MISSING_PROPERTY_IN_ARRAY_ITEM',
            location: {
              line: pos.line,
              column: pos.column,
            },
            component: getComponentForNode(node),
            suggestion: `Add the '${requiredProp}' property to the item at index ${index} in '${arrayPropName}'.`,
          } as EnhancedValidationIssue);
        }
      }
    });
    
    return issues;
  };
}

/**
 * Validates that an action handler has correct parameters and return type
 */
function validateActionImplementation(node: ts.Node): Array<ValidationIssue> {
  if (!ts.isObjectLiteralExpression(node)) {return [];}
  
  const properties = extractObjectProperties(node);
  const runProp = properties['run'] || properties['handler'];
  
  if (!runProp) {return [];} // Missing handler, handled by other validators
  
  const issues: Array<ValidationIssue> = [];
  
  // Check if it's a function
  if (!ts.isArrowFunction(runProp) && 
      !ts.isFunctionExpression(runProp) && 
      !ts.isFunctionDeclaration(runProp)) {
    return [];
  }
  
  // Check function parameters
  const func = runProp as ts.FunctionLikeDeclaration;
  
  // Action handlers should have at least one parameter (auth/context)
  if (func.parameters.length === 0) {
    const pos = getNodePosition(func);
    issues.push({
      severity: ValidationSeverity.WARNING,
      message: "Action handler should have a parameter for auth/context object.",
      code: 'STRUCTURE_ACTION_HANDLER_NO_PARAMS',
      location: {
        line: pos.line,
        column: pos.column,
      },
      component: PluginComponent.ACTIONS,
      suggestion: "Add a parameter to access auth information: run: ({ auth }) => {}",
    } as EnhancedValidationIssue);
  }

  // Check for async keyword or if it returns a Promise
  let isAsyncFunction = false;
  if (func.modifiers) {
    isAsyncFunction = func.modifiers.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
  }
  
  if (!isAsyncFunction) {
    const pos = getNodePosition(func);
    issues.push({
      severity: ValidationSeverity.WARNING,
      message: "Action handler should be an async function or return a Promise.",
      code: 'STRUCTURE_ACTION_HANDLER_NOT_ASYNC',
      location: {
        line: pos.line,
        column: pos.column,
      },
      component: PluginComponent.ACTIONS,
      suggestion: "Make your action handler async: run: async ({ auth }) => {}",
    } as EnhancedValidationIssue);
  }
  
  return issues;
}

/**
 * Detect improperly nested plugin elements
 */
function validatePluginStructure(node: ts.Node): Array<ValidationIssue> {
  if (!ts.isObjectLiteralExpression(node)) {return [];}
  
  const issues: Array<ValidationIssue> = [];
  const properties = extractObjectProperties(node);
  
  // Check that actions isn't nested inside another property (except defineApp)
  if (properties['actions'] && !isPropertyOfDefineApp(node)) {
    const actionsProp = findPropertyByValue(node as ts.ObjectLiteralExpression, properties['actions']);
    if (actionsProp) {
      const pos = getNodePosition(actionsProp);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: "'actions' must be a direct property of defineApp, not nested in another object.",
        code: 'STRUCTURE_IMPROPER_NESTING',
        location: {
          line: pos.line,
          column: pos.column,
        },
        component: PluginComponent.DEFINE_APP,
        suggestion: "Move 'actions' to be a top-level property in the defineApp object.",
      } as EnhancedValidationIssue);
    }
  }
  
  // Check for unrecognized properties in defineApp
  if (isPropertyOfDefineApp(node)) {
    const knownProps = [
      'name', 'key', 'auth', 'actions', 'description', 'version', 'icon', 'settings'
    ];
    
    for (const prop in properties) {
      if (!knownProps.includes(prop)) {
        const propNode = findPropertyByName(node as ts.ObjectLiteralExpression, prop);
        if (propNode) {
          const pos = getNodePosition(propNode);
          issues.push({
            severity: ValidationSeverity.WARNING,
            message: `Unknown property '${prop}' in defineApp. Recognized properties are: ${knownProps.join(', ')}.`,
            code: 'STRUCTURE_UNKNOWN_PROPERTY',
            location: {
              line: pos.line,
              column: pos.column,
            },
            component: PluginComponent.DEFINE_APP,
          } as EnhancedValidationIssue);
        }
      }
    }
  }
  
  return issues;
}

/**
 * Check if a node is a property of a defineApp call
 */
function isPropertyOfDefineApp(node: ts.Node): boolean {
  // Check if the parent is an object literal expression
  let parent = node.parent;
  while (parent) {
    if (ts.isCallExpression(parent) && 
        ts.isIdentifier(parent.expression) && 
        parent.expression.text === 'defineApp') {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * Find a property by name in an object literal
 */
function findPropertyByName(objLiteral: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  for (const prop of objLiteral.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const propName = prop.name;
      if ((ts.isIdentifier(propName) && propName.text === name) ||
          (ts.isStringLiteral(propName) && propName.text === name)) {
        return prop;
      }
    }
  }
  return undefined;
}

/**
 * Find a property by its value
 */
function findPropertyByValue(objLiteral: ts.ObjectLiteralExpression, value: ts.Expression): ts.PropertyAssignment | undefined {
  for (const prop of objLiteral.properties) {
    if (ts.isPropertyAssignment(prop) && prop.initializer === value) {
      return prop;
    }
  }
  return undefined;
}

/**
 * Determine which component a node belongs to (for context in error messages)
 */
function getComponentForNode(node: ts.Node): PluginComponent | undefined {
  // Start with the node and traverse up the tree
  let current: ts.Node | undefined = node;
  
  while (current) {
    // Check for defineApp call expression
    if (ts.isCallExpression(current) && 
        ts.isIdentifier(current.expression) && 
        current.expression.text === 'defineApp') {
      return PluginComponent.DEFINE_APP;
    }
    
    // Check for actions array
    if (ts.isPropertyAssignment(current) && 
        ts.isArrayLiteralExpression(current.initializer)) {
      const name = current.name;
      if ((ts.isIdentifier(name) && name.text === 'actions') ||
          (ts.isStringLiteral(name) && name.text === 'actions')) {
        return PluginComponent.ACTIONS;
      }
    }
    
    // Check for auth object
    if (ts.isPropertyAssignment(current) && 
        ts.isObjectLiteralExpression(current.initializer)) {
      const name = current.name;
      if ((ts.isIdentifier(name) && name.text === 'auth') ||
          (ts.isStringLiteral(name) && name.text === 'auth')) {
        return PluginComponent.AUTH;
      }
    }
    
    // Move up the tree
    current = current.parent;
  }
  
  return undefined;
}

/**
 * Creates a more specific validator for field interfaces based on field type
 */
function createFieldTypeValidator(fieldType: string): (node: ts.Node) => Array<ValidationIssue> {
  return (node: ts.Node) => {
    if (!ts.isObjectLiteralExpression(node)) {return [];}
    
    const issues: Array<ValidationIssue> = [];
    const properties = extractObjectProperties(node);
    const type = properties['type'];
    
    if (!type || !ts.isStringLiteral(type)) {return issues;}
    
    if (type.text === fieldType) {
      // Check for specific required properties based on field type
      const requiredProps: Array<string> = ['key', 'label', 'type'];
      
      switch (fieldType) {
        case 'dropdown': {
          // Additional validations for dropdown type
          if (properties['options'] && ts.isArrayLiteralExpression(properties['options'])) {
            // Validate that array elements are objects with label and value
            for (const option of properties['options'].elements) {
              if (option && ts.isObjectLiteralExpression(option)) {
                const optProps = extractObjectProperties(option);
                if (!optProps['label'] || !optProps['value']) {
                  const pos = getNodePosition(option);
                  issues.push({
                    severity: ValidationSeverity.ERROR,
                    message: "Dropdown option must have 'label' and 'value' properties.",
                    code: 'STRUCTURE_INVALID_DROPDOWN_OPTION',
                    location: {
                      line: pos.line,
                      column: pos.column,
                    },
                    component: PluginComponent.FIELDS,
                  } as EnhancedValidationIssue);
                }
              }
            }
          }
          break;
        }
          
        case 'dynamic': {
          // Fields array is required for dynamic fields
          if (!properties['fields'] || !ts.isArrayLiteralExpression(properties['fields'])) {
            const pos = getNodePosition(node);
            issues.push({
              severity: ValidationSeverity.ERROR,
              message: "Dynamic field must have a 'fields' array.",
              code: 'STRUCTURE_MISSING_DYNAMIC_FIELDS',
              location: {
                line: pos.line,
                column: pos.column,
              },
              component: PluginComponent.FIELDS,
            } as EnhancedValidationIssue);
          }
          break;
        }

        case 'default': {
          if (properties['default']) {
            const pos = getNodePosition(node);
            issues.push({
              severity: ValidationSeverity.ERROR,
              message: "Default field must not have a 'default' property.",
              code: 'STRUCTURE_DEFAULT_FIELD_DEFAULT',
              location: {
                line: pos.line,
                column: pos.column,
              },
            });
          }
          break;
        }
        
        default: {
          // No specific validations for other field types
          break;
        }
      }
      
      // Check if all required properties exist
      for (const prop of requiredProps) {
        if (!properties[prop]) {
          const pos = getNodePosition(node);
          issues.push({
            severity: ValidationSeverity.ERROR,
            message: `Field of type '${fieldType}' is missing required property '${prop}'.`,
            code: 'STRUCTURE_MISSING_FIELD_PROPERTY',
            location: {
              line: pos.line,
              column: pos.column,
            },
            component: PluginComponent.FIELDS,
          } as EnhancedValidationIssue);
        }
      }
    }
    
    return issues;
  };
}

/**
 * Validates the 'dependsOn' property of an object literal, ensuring it's an array of strings.
 * @param node The node containing the dependsOn property
 * @returns Array of validation issues found
 */
function validateDependsOnProperty(
  node: ts.Node
): Array<ValidationIssue> {
  // Only process object literal expressions
  if (!ts.isObjectLiteralExpression(node)) {
    return [];
  }

  const issues: Array<ValidationIssue> = [];
  const dependsOnProperty = node.properties.find(prop => {
    if (!ts.isPropertyAssignment(prop)) {
      return false;
    }
    const name = prop.name;
    return ts.isIdentifier(name) && name.text === 'dependsOn';
  });

  if (!dependsOnProperty || !ts.isPropertyAssignment(dependsOnProperty)) {
    return [];
  }

  const initializer = dependsOnProperty.initializer;
  const pos = getNodePosition(initializer);

  // Check if dependsOn is an array
  if (!ts.isArrayLiteralExpression(initializer)) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: "The 'dependsOn' property must be an array of strings.",
      code: 'STRUCTURE_INVALID_DEPENDSON',
      location: {
        line: pos.line,
        column: pos.column,
      },
      component: getComponentForNode(node),
      suggestion: "Change 'dependsOn' to an array: [\"dependency1\", \"dependency2\"]",
    } as EnhancedValidationIssue);
    return issues;
  }

  // Check if the array is empty (warning, not an error)
  if (initializer.elements.length === 0) {
    issues.push({
      severity: ValidationSeverity.WARNING,
      message: "The 'dependsOn' array is empty. If there are no dependencies, consider removing this property.",
      code: 'STRUCTURE_EMPTY_DEPENDSON',
      location: {
        line: pos.line,
        column: pos.column,
      },
      component: getComponentForNode(node),
      suggestion: "Either add dependencies or remove the empty 'dependsOn' property.",
    } as EnhancedValidationIssue);
    return issues;
  }

  // Check each element in the array is a string
  for (let i = 0; i < initializer.elements.length; i++) {
    const element = initializer.elements[i];
    if (!element) {
      continue;
    }
    
    if (!ts.isStringLiteral(element) && !ts.isNoSubstitutionTemplateLiteral(element)) {
      const elementPos = getNodePosition(element);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Element at index ${i} in 'dependsOn' must be a string.`,
        code: 'STRUCTURE_INVALID_DEPENDSON_ELEMENT',
        location: {
          line: elementPos.line,
          column: elementPos.column,
        },
        component: getComponentForNode(node),
        suggestion: "Ensure all items in the 'dependsOn' array are strings.",
      } as EnhancedValidationIssue);
    }
  }

  // Check for duplicate entries in the array
  const valueSet = new Set<string>();
  for (let i = 0; i < initializer.elements.length; i++) {
    const element = initializer.elements[i];
    if (element && (ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element))) {
      const value = element.text;
      if (valueSet.has(value)) {
        const elementPos = getNodePosition(element);
        issues.push({
          severity: ValidationSeverity.WARNING,
          message: `Duplicate dependency '${value}' found in 'dependsOn' array.`,
          code: 'STRUCTURE_DUPLICATE_DEPENDSON',
          location: {
            line: elementPos.line,
            column: elementPos.column,
          },
          component: getComponentForNode(node),
          suggestion: "Remove duplicate dependencies from the 'dependsOn' array.",
        } as EnhancedValidationIssue);
      } else {
        valueSet.add(value);
      }
    }
  }

  return issues;
}

/**
 * Validate fields in auth component
 */
function validateAuthFields(node: ts.Node): Array<ValidationIssue> {
  if (!ts.isObjectLiteralExpression(node)) {return [];}
  
  const properties = extractObjectProperties(node);
  const fields = properties['fields'];
  
  if (!fields || !ts.isArrayLiteralExpression(fields)) {return [];}
  
  const issues: Array<ValidationIssue> = [];
  
  // Check each field in the array
  for (const field of fields.elements) {
    if (field && ts.isObjectLiteralExpression(field)) {
      // Validate dependsOn property
      issues.push(...validateDependsOnProperty(field));
      
      // Validate field structure based on its type
      const fieldProps = extractObjectProperties(field);
      if (fieldProps['type'] && ts.isStringLiteral(fieldProps['type'])) {
        const fieldType = fieldProps['type'].text;
        // Apply specific validations based on field type
        issues.push(...createFieldTypeValidator(fieldType)(field));
      } else {
        const pos = getNodePosition(field);
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: "Field must have a 'type' property that is a string literal.",
          code: 'STRUCTURE_MISSING_FIELD_TYPE',
          location: {
            line: pos.line,
            column: pos.column,
          },
          component: PluginComponent.FIELDS,
        } as EnhancedValidationIssue);
      }
    }
  }
  
  return issues;
}

// ============================================================================
// ========================== Trigger Validation ============================
// ============================================================================

/**
 * Validate the structure of the 'triggers' property within defineApp
 */
function validateTriggersStructure(triggersProperty: ts.PropertyAssignment): Array<EnhancedValidationIssue> {
  const issues: Array<EnhancedValidationIssue> = [];
  const value = triggersProperty.initializer;

  // Triggers should be an array
  if (!ts.isArrayLiteralExpression(value)) {
    const propPos = getNodePosition(triggersProperty);
    issues.push({
      severity: ValidationSeverity.ERROR,
      message: "The 'triggers' property must be an array.",
      code: 'STRUCTURE_TRIGGERS_NOT_ARRAY',
      location: {
        line: propPos.line,
        column: propPos.column,
      },
      component: PluginComponent.DEFINE_APP, // Assuming triggers are part of defineApp
    });
    return issues;
  }

  // Validate each trigger in the array
  for (let i = 0; i < value.elements.length; i++) {
    const triggerNode = value.elements[i];

    // Triggers should be defined using defineTrigger or as object literals
    if (triggerNode && ts.isCallExpression(triggerNode) && 
        ts.isIdentifier(triggerNode.expression) && 
        triggerNode.expression.text === 'defineTrigger') {
      // Check if defineTrigger was called with arguments
      if (triggerNode.arguments.length === 0) {
        const triggerPos = getNodePosition(triggerNode);
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Trigger at index ${i} is missing configuration. defineTrigger requires an object argument.`,          code: 'STRUCTURE_TRIGGER_NO_ARGS',
          location: {
            line: triggerPos.line,
            column: triggerPos.column,
          },
          component: PluginComponent.TRIGGERS, // Use TRIGGERS component
        });
        continue;
      }

      // Get the trigger configuration object
      const triggerArg = triggerNode.arguments[0];
      if (triggerArg && !ts.isObjectLiteralExpression(triggerArg)) {
        const argPos = getNodePosition(triggerArg);
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Trigger at index ${i} must be configured with an object literal.`,          code: 'STRUCTURE_TRIGGER_NOT_OBJECT',
          location: {
            line: argPos.line,
            column: argPos.column,
          },
          component: PluginComponent.TRIGGERS, // Use TRIGGERS component
        });
        continue;
      }

      // Validate trigger properties if triggerArg exists and is an object literal
      if (triggerArg && ts.isObjectLiteralExpression(triggerArg)) {
        issues.push(...validateTriggerProperties(triggerArg, i));
      }
    } else if (triggerNode && ts.isObjectLiteralExpression(triggerNode)) {
      // If it's a direct object literal, validate its properties
      issues.push(...validateTriggerProperties(triggerNode, i));
    } else {
      const triggerPos = getNodePosition(triggerNode);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Trigger at index ${i} must be defined using defineTrigger or as an object literal.`,        code: 'STRUCTURE_INVALID_TRIGGER_DEFINITION',
        location: {
          line: triggerPos.line,
          column: triggerPos.column,
        },
        component: PluginComponent.TRIGGERS, // Use TRIGGERS component
      });
    }
  }

  return issues;
}

/**
 * Validate the properties of a trigger object
 */
function validateTriggerProperties(triggerObj: ts.ObjectLiteralExpression, index: number): Array<EnhancedValidationIssue> {
  const issues: Array<EnhancedValidationIssue> = [];
  const properties = extractObjectProperties(triggerObj);
  const triggerTypeProperty = properties['type'];
  const triggerPos = getNodePosition(triggerObj);

  // Required properties
  const requiredProps = ['name', 'key', 'type', 'description'];
  for (const requiredProp of requiredProps) {
    if (!properties[requiredProp]) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Trigger at index ${index} is missing required property '${requiredProp}'.`,        code: 'STRUCTURE_TRIGGER_MISSING_PROPERTY',
        location: triggerPos,
        component: PluginComponent.TRIGGERS, // Use TRIGGERS component
        suggestion: `Add the '${requiredProp}' property to the trigger definition.`,      });
    }
  }

  // Validate 'type' property value
  if (triggerTypeProperty && ts.isStringLiteral(triggerTypeProperty)) {
    const typeValue = triggerTypeProperty.text;
    const validTypes = ["messaging", "webhook", "polling", "internal"];
    if (!validTypes.includes(typeValue)) {
      const typePos = getNodePosition(triggerTypeProperty);
      issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Invalid trigger type '${typeValue}'. Must be one of: ${validTypes.join(', ')}.`,        code: 'STRUCTURE_INVALID_TRIGGER_TYPE',
        location: typePos,
        component: PluginComponent.TRIGGERS, // Use TRIGGERS component
      });
    }

    // Polling specific validation
    if (typeValue === 'polling') {
      if (properties['pollInterval'] && !ts.isNumericLiteral(properties['pollInterval'])) {
        const pollPos = getNodePosition(properties['pollInterval']);
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Property 'pollInterval' for polling trigger must be a number.`,          code: 'STRUCTURE_INVALID_TYPE',
          location: pollPos,
          component: PluginComponent.TRIGGERS, // Use TRIGGERS component
        });
      } else if (!properties['run']) { // Polling triggers typically need a run function
        issues.push({
          severity: ValidationSeverity.WARNING, // Warning as it might not *always* be an error
          message: `Polling trigger at index ${index} should typically have a 'run' function.`,          code: 'STRUCTURE_TRIGGER_MISSING_RUN',
          location: triggerPos,
          component: PluginComponent.TRIGGERS, // Use TRIGGERS component
        });
      }
    }
    // Webhook specific validation
    if (typeValue === 'webhook' || typeValue === 'messaging') {
      if (properties['registerHook'] && !isFunctionLike(properties['registerHook'])) {
         issues.push(createInvalidTypeError('registerHook', 'function', triggerObj));
      }
      if (properties['unregisterHook'] && !isFunctionLike(properties['unregisterHook'])) {
         issues.push(createInvalidTypeError('unregisterHook', 'function', triggerObj));
      }
      if (properties['getRespondingAction'] && !isFunctionLike(properties['getRespondingAction'])) {
         issues.push(createInvalidTypeError('getRespondingAction', 'function', triggerObj));
      }
    }

  } else if (properties['type']) {
     issues.push(createInvalidTypeError('type', 'string', triggerObj));
  }

  // Validate optional property types
  if (properties['name'] && !ts.isStringLiteral(properties['name'])) {
     issues.push(createInvalidTypeError('name', 'string', triggerObj));
  }
  if (properties['key'] && !ts.isStringLiteral(properties['key'])) {
     issues.push(createInvalidTypeError('key', 'string', triggerObj));
  }
  if (properties['description'] && !ts.isStringLiteral(properties['description'])) {
     issues.push(createInvalidTypeError('description', 'string', triggerObj));
  }
  if (properties['run'] && !isFunctionLike(properties['run'])) {
     issues.push(createInvalidTypeError('run', 'function', triggerObj));
  }
  if (properties['testRun'] && !isFunctionLike(properties['testRun'])) {
     issues.push(createInvalidTypeError('testRun', 'function', triggerObj));
  }
  if (properties['filter'] && !isFunctionLike(properties['filter'])) {
     issues.push(createInvalidTypeError('filter', 'function', triggerObj));
  }
  if (properties['getInterval'] && !isFunctionLike(properties['getInterval'])) {
     issues.push(createInvalidTypeError('getInterval', 'function', triggerObj));
  }
  if (properties['showWebhookUrl'] && !isBooleanLiteral(properties['showWebhookUrl'])) {
     issues.push(createInvalidTypeError('showWebhookUrl', 'boolean', triggerObj));
  }
  if (properties['pollIntervalOptions'] && !ts.isArrayLiteralExpression(properties['pollIntervalOptions'])) {
     issues.push(createInvalidTypeError('pollIntervalOptions', 'array', triggerObj));
  } else if (properties['pollIntervalOptions'] && ts.isArrayLiteralExpression(properties['pollIntervalOptions'])) {
    // Check array elements are numbers
    for (const elem of (properties['pollIntervalOptions'] as ts.ArrayLiteralExpression).elements) {
      if (!ts.isNumericLiteral(elem)) {
        const elemPos = getNodePosition(elem);
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Elements in 'pollIntervalOptions' must be numbers.`,          code: 'STRUCTURE_INVALID_TYPE',
          location: elemPos,
          component: PluginComponent.TRIGGERS, // Use TRIGGERS component
        });
        break; // Only report first invalid element
      }
    }
  }

  // Validate dependsOn property if present
  issues.push(...validateDependsOnProperty(triggerObj));

  return issues;
}

/** Helper to check if a node is function-like */
function isFunctionLike(node: ts.Node): boolean {
  return node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node));
}

/** Helper to check if a node is a boolean literal */
function isBooleanLiteral(node: ts.Node): boolean {
  return node && (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword);
}

/** Helper to create a type error issue */
function createInvalidTypeError(propName: string, expectedType: string, node: ts.ObjectLiteralExpression): EnhancedValidationIssue {
  const properties = extractObjectProperties(node);
  const propertyNode = properties[propName];
  const pos = getNodePosition(propertyNode || node); // Fallback to object position if prop node not found
  return {
    severity: ValidationSeverity.ERROR,
    message: `Property '${propName}' must be a ${expectedType}.`,
    code: 'STRUCTURE_INVALID_TYPE',
    location: pos,
    component: getComponentForNode(node), // Attempt to determine component context
    suggestion: `Ensure the value for '${propName}' is a valid ${expectedType}.`,
  } as EnhancedValidationIssue;
} 