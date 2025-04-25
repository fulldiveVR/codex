/* eslint-disable no-console */
import type { ResponseOutput } from './responses'; // Assuming ResponseOutput is exported from here

import fs from 'fs';
import path from 'path';

// Define a directory to store responses for testing
const RESPONSE_STORAGE_DIR = path.resolve(process.cwd(), 'tmp/responses');

/**
 * Handles the complete AI response.
 * Extracts TypeScript code block from the response text and saves it as a .ts file.
 * TODO: Implement sending the extracted TS file using axios.
 *
 * @param response The complete ResponseOutput object.
 */
export async function handleCompleteResponse(response: ResponseOutput): Promise<void> {
  console.log(`Handling complete response ID: ${response.id}`);

  try {
    // --- Extract TypeScript Code --- 
    let tsCode: string | null = null;

    // Ensure the first output item exists and is of type 'message'
    const firstOutputItem = response.output?.[0];

    if (firstOutputItem && firstOutputItem.type === 'message') {
      // Now TypeScript knows firstOutputItem is a MessageItem, which should have content
      const firstContent = firstOutputItem.content?.[0];

      if (firstContent && firstContent.type === 'output_text') {
        const rawText = firstContent.text;
        if (rawText) {
          // Trim the text and use a less strict regex (remove ^ and $ anchors)
          const trimmedText = rawText.trim();
          const codeBlockRegex = /```typescript\n([\s\S]*?)\n```/;
          const match = trimmedText.match(codeBlockRegex);
          if (match && match[1]) {
            tsCode = match[1];
            console.log("Extracted TypeScript code block.");
          } else {
            console.warn("Could not extract TypeScript code block from response text (regex mismatch).");
            // Log the text that failed to match for debugging
            console.log("--- Text that failed regex match ---");
            console.log(trimmedText);
            console.log("------------------------------------");
          }
        } else {
          console.warn("First output text content was empty.");
        }
      } else {
        console.warn("First content item was not of type 'output_text' or was missing.");
      }
    } else {
      console.warn("Response structure did not contain a 'message' type output item at index 0.");
    }

    if (!tsCode) {
      console.error("No TypeScript code found to save.");
      return;
    }

    // --- Local File Saving Logic (for testing) ---
    // Ensure the storage directory exists
    if (!fs.existsSync(RESPONSE_STORAGE_DIR)) {
      fs.mkdirSync(RESPONSE_STORAGE_DIR, { recursive: true });
      console.log(`Created response storage directory: ${RESPONSE_STORAGE_DIR}`);
    }

    const filename = `${response.id || `response-${Date.now()}`}.ts`; // Save as .ts file
    const filepath = path.join(RESPONSE_STORAGE_DIR, filename);

    // Write the extracted TypeScript code to the file
    fs.writeFileSync(filepath, tsCode);
    console.log(`TypeScript code saved locally for testing: ${filepath}`);

  } catch (error) {
    console.error('Error handling complete response:', error);
  }

  // --- Axios File Sending Logic (Placeholder for .ts file) ---
  /*
  try {
    if (!tsCode) { 
      console.error("Cannot send file via axios: No TypeScript code was extracted.");
      return; 
    }
    
    // TODO: Determine the actual filename expected by the receiving service
    const filename = `${response.id || `response-${Date.now()}`}.ts`;

    // Create a Buffer or Blob from the TS code string
    const dataBuffer = Buffer.from(tsCode, 'utf-8');

    // Use FormData to send as a file
    const formData = new FormData();
    // The 'file' key might need adjustment based on the receiving API
    formData.append('file', dataBuffer, filename);

    // TODO: Get target URL from config or environment variable
    const targetUrl = 'YOUR_TARGET_SERVICE_URL_HERE';

    // TODO: Add axios import: import axios from 'axios';
    // const axiosResponse = await axios.post(targetUrl, formData, {
    //   headers: {
    //     ...formData.getHeaders(), // Important for multipart/form-data
    //     // Add any other required headers (e.g., Authorization)
    //   },
    // });
    // console.log(`TypeScript file sent to service: ${axiosResponse.status}`);

  } catch (error) {
    console.error('Error sending TS file via axios:', error);
  }
  */
} 