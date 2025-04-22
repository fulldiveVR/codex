# Codex CLI Architecture Summary (Subtasks 1.1 - 1.5)

This document summarizes the findings for Task 1: Analyze Existing Project Structure.

## 1. Main Entry Point

-   The primary entry point for the CLI application is `codex-cli/src/cli.tsx`.
-   It uses the `meow` library for parsing command-line arguments and flags.
-   It handles initialization, configuration loading (`loadConfig`), API key validation, and different execution modes (interactive chat, quiet mode, full-context mode, config editing, completion generation).

## 2. Core Application Initialization

-   For the default interactive mode, `cli.tsx` renders the main React component `App` (from `codex-cli/src/app.tsx`) using the `ink` library for terminal UI rendering.
-   It passes configuration (`config`), initial prompt, image paths, approval policy, and other flags to the `App` component.
-   For quiet mode, it uses an `AgentLoop` instance directly (`codex-cli/src/utils/agent/agent-loop.ts`).
-   For full-context mode, it calls `runSinglePass` (from `codex-cli/src/cli-singlepass.tsx`), which initializes `SinglePassApp` (from `codex-cli/src/components/singlepass-cli-app.tsx`).

## 3. Key Third-Party Dependencies (`package.json`)

-   **AI/LLM:**
    -   `openai`: OpenAI SDK for interactions.
    -   `@anthropic-ai/sdk`: Anthropic SDK (likely for Claude models).
-   **CLI & UI:**
    -   `ink`: React renderer for interactive command-line interfaces.
    -   `meow`: CLI argument parsing.
    -   `chalk`: Terminal string styling.
    -   `boxen`: Create boxes in the terminal.
    -   `ora`: Elegant terminal spinners.
    -   `inquirer`: Interactive command line user interfaces (might be used for prompts).
    -   `cli-table3`: Pretty unicode tables for CLI.
    -   `figlet`: ASCII art generation from text.
    -   `gradient-string`: Color gradients for terminal output.
-   **Backend/Server (Potentially for MCP/Dev Server):**
    -   `express`: Web framework.
    -   `cors`: CORS middleware for Express.
    -   `helmet`: Security middleware for Express.
    -   `fastmcp`: Likely the MCP server implementation.
-   **Utilities:**
    -   `dotenv`: Loading environment variables.
    -   `jsonwebtoken`: JSON Web Token handling.
    -   `lru-cache`: Least Recently Used cache.
    -   `fuse.js`: Fuzzy searching.
-   **Dev Dependencies:**
    -   `prettier`: Code formatter.
    -   `git-cliff`: Changelog generator.

## 4. Project Folder Structure (High-Level)

-   `codex-cli/`: Contains the main source code for the CLI tool.
    -   `src/`: Source files (TypeScript/TSX).
        -   `components/`: React components for the Ink UI.
        -   `utils/`: Utility functions (config, agent logic, storage, etc.).
        -   `app.tsx`: Main interactive application component.
        -   `cli.tsx`: Main CLI entry point.
        -   `cli-singlepass.tsx`: Entry point for single-pass mode.
-   `scripts/`: Contains helper scripts, including the PRD and Taskmaster dev scripts (`dev.js`).
-   `tasks/`: Contains generated task files (`tasks.json` and individual task markdown files).
-   `.cursor/`: Cursor-specific configuration and rules.
-   `docs/`: Project documentation (this file will be created here).
-   `node_modules/`: Project dependencies.
-   Configuration files: `.env.example`, `package.json`, `package-lock.json`, `.gitignore`, `.prettierrc.toml`, etc.

## 5. Initial Architectural Pattern Observations

-   **Component-Based UI:** Uses React (`ink`) for building the terminal interface.
-   **Modular Utilities:** Code seems organized into utility modules (`utils/`) for different concerns (agent, config, models, etc.).
-   **Multiple Execution Modes:** Clear separation for interactive chat, quiet mode, and a distinct "full-context" single-pass mode.
-   **Configuration Driven:** Relies on environment variables (`dotenv`) and configuration files (`utils/config.ts`) for setup.
-   **Agent-Based Logic:** Core AI interaction appears encapsulated within an `AgentLoop` class.

## 6. Component Data Flow (Subtask 1.2)

-   **State Management:** Primarily uses React's `useState` hook within individual components for managing UI state (input values, history, loading states, application state machine, etc.). There doesn't appear to be a global state manager like Redux or Zustand. Props are passed down from parent components (`cli.tsx` -> `App.tsx` -> `TerminalChat.tsx` -> `TerminalChatInput.tsx`).
-   **Input Capture (`TerminalChatInput` - Interactive Mode):**
    -   Uses the `<MultilineTextEditor>` component to capture user input (`input` state).
    -   `useInput` hook from Ink handles key presses for history navigation (up/down arrows), special commands (`/clear`, `/help`, etc.), and submission (Enter).
    -   On submit (`onSubmit` callback), the `input` state is processed:
        -   Special commands are handled directly.
        -   Regular prompts are packaged into an `inputItem` (using `createInputItem` utility, which handles image paths).
        -   The `submitInput` prop (passed down from `TerminalChat`) is called with the `inputItem`. This likely triggers the `AgentLoop`.
        -   Input state (`input`) is cleared, and history is updated (`addToHistory`, `setHistory`).
-   **Input Capture (`SinglePassApp` - Full-Context Mode):**
    -   Uses a simpler `<InputPrompt>` component (wrapping `<TextInput>`) to capture the user prompt (`value` state).
    -   `useInput` handles key presses for history and submission.
    -   On submit (`onSubmit` callback):
        -   The `runSinglePassTask` function is called with the input value.
        -   Inside `runSinglePassTask`, the prompt is combined with loaded file context (`renderTaskContext`).
        -   An OpenAI API call (`openai.beta.chat.completions.parse`) is made directly within this component.
-   **Data Flow to Agent:**
    -   Interactive Mode: `TerminalChat` likely initializes and holds the `AgentLoop` instance. The `submitInput` callback passes the formatted user `inputItem` to the agent's `run` method.
    -   Single-Pass Mode: `SinglePassApp` makes the OpenAI API call directly, bypassing the `AgentLoop` used in interactive mode.
-   **State Updates:** Components update their internal state using `setState` based on user actions (typing, submitting), API responses (loading state, errors), or lifecycle events (`useEffect` for loading initial data like history or file context).
-   **Event Handling:** Primarily driven by Ink's `useInput` hook for key presses and component callbacks (`onSubmit`, `onResult` for confirmations). `useEffect` is used for asynchronous operations like loading data or initiating API calls.

## 7. Prompt Handling Mechanism (Subtask 1.3)

-   **Instructions Loading (`utils/config.ts`):**
    -   The `loadConfig` function reads base instructions from `~/.codex/instructions.md`.
    -   It automatically discovers and loads a project-specific `codex.md` (or `.codex.md`, `CODEX.md`) file by searching the current directory and walking up to the Git root.
    -   These two instruction sources are combined, separated by `\n\n--- project-doc ---\n\n`.
    -   This combined `instructions` string is passed to the `AgentLoop` or used in API calls.
-   **Context Loading (`utils/singlepass/context_files.ts`):**
    -   The `getFileContents` function performs a Breadth-First Search (BFS) starting from the root path.
    -   It reads directory entries, respecting ignore patterns loaded via `loadIgnorePatterns` (which defaults to a built-in list or reads a specified ignore file).
    -   It skips symbolic links.
    -   It reads the content of non-ignored files, utilizing an LRU cache (`FILE_CONTENTS_CACHE`) based on file path, mtime, and size to avoid re-reading unchanged files.
    -   It returns an array of `FileContent` objects (`{ path: string, content: string }`).
-   **Prompt Construction (Single-Pass Mode - `utils/singlepass/context.ts`):**
    -   The `renderTaskContext` function takes the user prompt, input paths, directory structure (optional string), and loaded `FileContent` array.
    -   It formats these into a single string to be sent to the AI.
    -   It includes explicit instructions about output requirements (full file content, only changing files under input paths, absolute paths).
    -   File contents are wrapped in an XML-like structure (`<files><file><path>...</path><content><![CDATA[...]]></content></file>...</files>`).
-   **Prompt Construction (Interactive Mode - `utils/agent/agent-loop.ts`):**
    -   The `AgentLoop` class manages the conversation history.
    -   The `run` method takes the user's input (packaged by `createInputItem` from `utils/input-utils.ts`, which combines text and base64-encoded images into a `ResponseInputItem.Message`).
    -   It prepends any necessary tool outputs (e.g., from previous function calls or aborted calls).
    -   It sends the current conversation turn (including system instructions from `config.instructions`, previous messages, and the new user input) to the OpenAI API (`this.oai.beta.chat.completions.parse` or similar, likely using the `messages` array format). The exact structure of the message array sent to the API isn't explicitly shown in the snippets but is standard for OpenAI chat completions.
-   **API Interaction (`utils/agent/agent-loop.ts`):**
    -   The `AgentLoop` uses the `openai` SDK instance (`this.oai`) initialized with API key, base URL, timeout, and default headers (including session ID).
    -   It handles streaming responses from the API (`stream = await this.oai.beta.chat.completions.stream(...)`).
    -   It processes events from the stream (`'function_call'`, `'text'`, `'error'`, etc.).
    -   Includes retry logic for rate limit errors (`APIConnectionTimeoutError`).

## 8. Output Generation Process (Subtask 1.4)

-   **Agent Response Handling (`utils/agent/agent-loop.ts`):**
    -   The `AgentLoop.run` method processes the streaming response from the OpenAI API.
    -   It iterates through events in the stream (`for await (const event of stream)`).
    -   Events like `response.output_item.done` contain individual response items (text, function calls).
    -   The `stageItem` internal function is used to queue items for display via the `onItem` callback (passed during `AgentLoop` initialization, likely connected to the UI update logic in `TerminalChat.tsx`). This staging includes a slight delay to handle potential cancellations.
    -   When a `function_call` event is received, `handleFunctionCall` is invoked.
        -   It parses arguments (`parseToolCallArguments`).
        -   It calls `handleExecCommand` for shell commands, which manages execution and user confirmation (`getCommandConfirmation` callback).
        -   The output of the function call (stdout/stderr/metadata) is packaged into a `function_call_output` item.
    -   The `response.completed` event signals the end of the stream. The loop prepares the `function_call_output` items generated during the stream to be included in the *next* turn's input.
    -   Error handling logic catches API errors (rate limits, timeouts, client errors) and surfaces system messages via `onItem`.
-   **Single-Pass Mode Response Handling (`components/singlepass-cli-app.tsx`):**
    -   The `runSinglePassTask` function directly calls `openai.beta.chat.completions.parse`.
    -   It expects a specific response format defined by `EditedFilesSchema` (likely containing file operations).
    -   If the response is valid and contains operations (`edited.ops`):
        -   It generates diffs (`generateDiffSummary`) and an edit summary (`generateEditSummary`).
        -   It updates the component state (`diffInfo`, `applyOps`, `state = 'confirm'`) to show the summary and diffs (`SummaryAndDiffs` component) and prompt for confirmation (`ConfirmationPrompt`).
    -   If the user confirms (`onResult(true)`), `applyFileOps` is called to write changes to the filesystem.
    -   If no valid ops are returned or the user skips, the state transitions accordingly (`'noops'`, `'skipped'`).
-   **Output Display (Interactive Mode):**
    -   The `onItem` callback in `AgentLoop` likely updates the state managed by `TerminalChat.tsx`, which then re-renders the list of messages/events using components like `TerminalChatResponse` or similar to display text, function calls, and outputs.
-   **Output Display (Single-Pass Mode):**
    -   The `SinglePassApp` component directly renders different UI states (`'thinking'`, `'confirm'`, `'applied'`, `'error'`, etc.) using Ink components (`WorkingSpinner`, `SummaryAndDiffs`, `ConfirmationPrompt`, `Text`).
