# Repty

**Terminal command history with natural language search** - All offline, no AI, just pure NLP magic.

## What is Repty?

Repty is a CLI tool that captures your terminal commands and lets you search them using natural language queries. No cloud services, no AI APIs - everything runs locally using offline NLP techniques.

## Features

-  **Natural Language Search**: "what git command did I use last Friday?"
-  **Date Parsing**: Search by "yesterday", "last week", "3 days ago"
-  **Smart Matching**: Fuzzy search with relevance scoring
-  **Command Chaining**: Automatically detects and suggests command sequences (e.g., `git add` → `commit` → `push`)
-  **Privacy First**: All data stored locally in SQLite
-  **Auto-exclude**: Automatically filters commands with sensitive patterns

## Installation

Install Repty globally via npm:

```bash
npm install -g repty
```

Or, if you're building from source:

```bash
npm install
npm run build
npm link
```

## Quick Start

### 1. Set up shell integration (automatic capture)

```bash
repty init
```

Follow the instructions to add the shell hook to your `~/.bashrc` or `~/.zshrc`.

### 2. Manually log a command

```bash
repty log "git reset --hard HEAD~1"
```

### 3. Search your history

```bash
repty search "git commands from last Friday"
repty search "npm install react"
repty search "command to reset git head"
```

### 4. Execute a command from history

```bash
repty run "git reset command"
```

This will search, let you select from matches, and execute after confirmation.

### 5. Detect and run command chains
If you frequently run commands together (like a Git workflow), Repty will detect them as a **Sequence**.

```bash
repty run "push my changes"
```

Repty will suggest the entire chain (e.g., `git add` + `git commit` + `git push`) and allow you to run them sequentially.

## Commands

### `repty search <query>`
Search command history using natural language.

**Examples:**
```bash
repty search "git commands from yesterday"
repty search "npm install react"
repty search "docker commands last week"
```

### `repty run <query>`
Search and execute a command from history.

**Examples:**
```bash
repty run "git reset command"
repty run "npm start"
```

### `repty log <command>`
Manually log a command to history.

**Options:**
- `-d, --directory <dir>`: Specify working directory
- `-e, --exit-code <code>`: Specify exit code

**Examples:**
```bash
repty log "git commit -m 'fix: bug'"
repty log "npm test" --exit-code 1
```

### `repty recent`
Show recent commands.

**Options:**
- `-n, --number <count>`: Number of commands to show (default: 20)

**Examples:**
```bash
repty recent
repty recent -n 50
```

### `repty stats`
Show command history statistics.

```bash
repty stats
```

### `repty init`
Display shell integration setup instructions.

```bash
repty init
```

### `repty clear`
Clear command history or sequences.

**Options:**
- `-s, --sequences`: Clear only command sequences (chains)
- `-a, --all`: Clear all command history and sequences

## How It Works

### Natural Language Processing

Repty uses offline NLP libraries to parse your queries:

1. **Date Parsing** (`chrono-node`): Extracts date references like "last Friday", "yesterday", "3 days ago"
2. **Tokenization** (`natural`): Breaks down queries into meaningful tokens
3. **Stemming**: Reduces words to their root form for better matching
4. **Command Type Detection**: Identifies command types (git, npm, docker, etc.)
5. **Fuzzy Matching**: Uses Levenshtein distance for typo tolerance
6. **Sequence Detection**: Identifies patterns of commands run in the same directory within a short timeframe

### Scoring Algorithm

Commands are ranked by relevance:
- **Command type match**: +50 points (exact), +25 points (partial)
- **Action keyword match**: +30 points
- **Keyword matches**: +10 points each
- **Fuzzy matches**: +1-5 points based on similarity
- **Recency bonus**: +1-5 points for recent commands

### Data Storage

All data is stored locally in `~/.repty/history.db` using SQLite:

```sql
CREATE TABLE commands (
  id INTEGER PRIMARY KEY,
  command TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  directory TEXT NOT NULL,
  exit_code INTEGER,
  tags TEXT,
  description TEXT
);
```

### Table: `command_chains`
Stores detected sequences and their frequency:
```sql
CREATE TABLE command_chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commands_text TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 1,
  last_used INTEGER NOT NULL
);
```

### Privacy & Security

- Commands containing sensitive patterns (password, token, secret, api_key) are automatically excluded
- All data stays on your machine
- No network requests
- No cloud services

## Example Queries

```bash
# Date-based searches
repty search "commands from last Friday"
repty search "git commands yesterday"
repty search "npm commands this week"

# Command type searches
repty search "git reset command"
repty search "docker build command"
repty search "npm install react"

# Action-based searches
repty search "command to commit"
repty search "command to push"
repty search "install command"

# Combined searches
repty search "git reset command from last week"
repty search "npm install from yesterday"
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## Tech Stack

- **TypeScript**: Type-safe development
- **sql.js**: Pure JavaScript SQLite database
- **natural**: NLP library for tokenization and text processing
- **chrono-node**: Natural language date parsing
- **commander**: CLI framework
- **inquirer**: Interactive prompts
- **chalk**: Terminal colors

## License

MIT
