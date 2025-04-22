import { Box, Text } from "ink";
import React from "react";

export interface ValidationErrorProps {
  message?: string;
}

/**
 * Displays a validation error message.
 * Uses a default message if none is provided.
 */
export function ValidationErrorMessage({
  message = "Invalid prompt. This tool can only be used to create plugins. Please provide a description of the plugin you want to create.",
}: ValidationErrorProps): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="red" paddingX={1} marginTop={1}>
      <Text color="red">{message}</Text>
    </Box>
  );
}