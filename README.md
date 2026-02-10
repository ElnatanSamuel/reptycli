# Repty

**Terminal command history with natural language search** - All offline, project-aware, and built for speed.

Repty is a professional CLI tool that captures your terminal history and makes it searchable using natural language. No cloud services, no AI APIs - everything runs locally using offline NLP techniques.

## Key Features

- **Project-Wide Search**: Automatically detects project roots (git/npm) to search across the whole codebase, not just your current folder.
- **Sequence Aliases**: Combine multiple commands into a single shorthand using the `|` separator.
- **Interactive Selection**: Choose exactly which command to run from multiple matches with a simple TUI picker.
- **CLI Shortcuts**: Super-short commands (`s`, `r`, `a`) designed for lightning-fast productivity.
- **Privacy First**: All data is stored locally in an SQLite database. No telemetry, no cloud.
- **Auto-Exclude**: Automatically filters sensitive data (passwords, tokens, api_keys) from history.

## Installation

Install Repty globally via npm:

```bash
npm install -g repty
```

### Setup

After installation, initialize the shell integration to start capturing commands:

```bash
repty init
```
This will add a small hook to your `~/.zshrc` or `~/.bashrc` to capture commands as you run them.

## Quick Start

| Command | Shortcut | Description |
| :--- | :--- | :--- |
| `repty search` | `repty s` | Search history with natural language |
| `repty run` | `repty r` | Search, pick, and execute a command |
| `repty alias` | `repty a` | Manage manual shortcuts and chains |

### Examples

```bash
# Search for that one git command from last week
repty s "git push from last Friday"

# Search and run an npm command
repty r "npm test"

# Create a complex workflow alias
repty a "ship-it" "npm run build | git add . | git commit -m 'Release' | git push"

# Run your new alias
repty r ship-it
```

## Commands

### `repty s <query>` (Search)
Searches your history. If you are inside a Git repository or NPM project, Repty automatically expands the search scope to include the **entire project**.

### `repty r <query>` (Run)
Finds and executes a command. If multiple relevant matches are found, it opens an **Interactive Picker**.

### `repty a <name> <command>` (Alias)
Creates a manual shorthand.
- Supports single commands: `repty a p "git push"`
- Supports sequences: `repty a deploy "npm run build | docker build ."`

### `repty clear`
Safely manage your history data.
- `repty clear --sequences`: Clear only detected command chains.
- `repty clear --all`: Reset everything (requires confirmation).

## How It Works

Repty uses local NLP processing to understand your intent:
1. **Date Extraction**: Understands "yesterday", "last week", "3 days ago".
2. **Weighted Scoring**: Ranks results based on command type, action keywords, and recency.
3. **Project Detection**: Climbs the directory tree to find your `.git` or `package.json` for scoped searching.
4. **Offline NLP**: Uses `natural` and `chrono-node` for all text analysis.

## Tech Stack

- **TypeScript** & **Node.js**
- **sql.js**: Pure JS SQLite implementation
- **natural**: Offline NLP and stemming
- **commander** & **inquirer**: CLI layout and interaction
- **boxen** & **chalk**: Premium terminal aesthetics

## License

MIT
