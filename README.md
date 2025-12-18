# Notemix

A powerful plugin to pack your notes into a single, context-rich file, perfect for feeding into AI models (LLMs) or archiving.

## Example Output

When you mix a folder containing notes `Project A.md` and `Budget.md`, the result looks like this:

```markdown
<!-- Start: Project A -->
# Project A
This is the content of project A...
<!-- End: Project A -->

<!-- Start: Budget -->
# Budget
This is the budget content...
<!-- End: Budget -->
```

## Purpose

**Why combine notes?**
When working with Large Language Models (LLMs) like Claude, ChatGPT, or Gemini, you often need to provide multiple files as context. Copy-pasting them one by one is tedious and loses file structure.

**Notemix** solves this by bundling an entire folder of markdown files into a single, well-structured document. This "mixed" file preserves filenames and content boundaries, making it easy for AI to understand your project's structure and content in one go.

## Features

- **Combine Notes**: Merges all `.md` files in a selected folder into one master file.
- **AI-Ready Format**: Clearly marks the start and end of each original note, helping LLMs distinguish between different files.
- **Customizable Output**: Choose where to save the combined file (Vault relative or absolute path).
- **Flexible Naming**: Define your own file name template with date and folder name placeholders.
- **Filtering**: Exclude specific files using glob patterns.

## How to Use

1.  **Right-click a folder** in the file explorer and select **Mix notes**.
2.  Alternatively, use the command palette (`Ctrl/Cmd + P`) and run **Mix notes from folder**.
3.  Confirm or edit the destination path in the popup modal.

## Settings

-   **Exclude Glob Pattern**: Ignore files matching a specific pattern (e.g., `**/Secret/**`).
-   **Default Export Path**: Set a default location for generated files.
-   **File Name Template**: Customize the output filename. Supported placeholders:
    -   `{foldername}`: Name of the source folder.
    -   `{date}`: Current date (format customizable).
    -   `{YYYY-MM-DD}`: Custom moment.js date format.
-   **Date Format**: Define the format for the `{date}` placeholder.

## Installation

1.  Download the latest release.
2.  Extract the files into your vault's `.obsidian/plugins/obsidian-notemix/` folder.
3.  Reload Obsidian and enable the plugin in Community Plugins settings.
