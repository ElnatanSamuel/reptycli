#!/bin/bash

# Repty Shell Integration
# This script captures commands automatically and logs them to repty

# Get the path to repty executable
REPTY_BIN="$(which repty)"

if [ -z "$REPTY_BIN" ]; then
  # If repty is not in PATH, try to find it relative to this script
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPTY_BIN="$SCRIPT_DIR/../dist/index.js"
fi

# Function to capture the last command
__repty_capture() {
  local last_command="$(history 1 | sed 's/^[ ]*[0-9]*[ ]*//')"
  local exit_code=$?
  local current_dir="$PWD"
  
  # Don't capture repty commands themselves
  if [[ "$last_command" != repty* ]] && [[ -n "$last_command" ]]; then
    # Run in background to avoid slowing down the shell
    (node "$REPTY_BIN" __capture__ "$last_command" "$exit_code" "$current_dir" &> /dev/null &)
  fi
}

# Set up the hook based on shell type
if [ -n "$BASH_VERSION" ]; then
  # Bash
  PROMPT_COMMAND="__repty_capture; $PROMPT_COMMAND"
elif [ -n "$ZSH_VERSION" ]; then
  # Zsh
  precmd() {
    __repty_capture
  }
fi
