#!/usr/bin/env node
import { Command } from 'commander';
import { searchCommand } from './cli/search';
import { executeCommand } from './cli/execute';
import { logCommand } from './cli/log';
import { CommandDatabase } from './database/db';
import { getConfig, shouldExcludeCommand } from './utils/config';
import { formatCommandList, formatStats } from './utils/formatter';

import chalk from 'chalk';
import fs from 'fs';
import os from 'os';
import path from 'path';


const program = new Command();

program
  .name('repty')
  .description('Terminal command history with natural language search')
  .version('1.0.0');

program
  .command('search <query...>')
  .description('Search command history using natural language')
  .action(async (queryParts: string[]) => {
    const query = queryParts.join(' ');
    await searchCommand(query);
  });

program
  .command('run <query...>')
  .description('Search and execute a command from history')
  .action(async (queryParts: string[]) => {
    const query = queryParts.join(' ');
    await executeCommand(query);
  });

program
  .command('log <command...>')
  .description('Manually log a command to history')
  .option('-d, --directory <dir>', 'Working directory')
  .option('-e, --exit-code <code>', 'Exit code', '0')
  .action(async (commandParts: string[], options: any) => {
    const command = commandParts.join(' ');
    await logCommand(command, options.directory, parseInt(options.exitCode));
  });

program
  .command('recent')
  .description('Show recent commands')
  .option('-n, --number <count>', 'Number of commands to show', '20')
  .action(async (options: any) => {
    const config = getConfig();
    const db = new CommandDatabase(config.dbPath);
    await db.init();
    
    try {
      const commands = db.getRecentCommands(parseInt(options.number));
      console.log(formatCommandList(commands));
    } finally {
      db.close();
    }
  });

program
  .command('stats')
  .description('Show command history statistics')
  .action(async () => {
    const config = getConfig();
    const db = new CommandDatabase(config.dbPath);
    await db.init();
    
    try {
      const stats = db.getStats();
      console.log(formatStats(stats));
    } finally {
      db.close();
    }
  });

program
  .command('init')
  .description('Set up shell integration automatically')
  .action(async () => {
    const shellIntegrationPath = path.join(__dirname, '../scripts/shell-integration.sh');
    const reptyDir = path.join(os.homedir(), '.repty');
    const targetScriptPath = path.join(reptyDir, 'shell-integration.sh');
    
    if (!fs.existsSync(shellIntegrationPath)) {
      console.error(chalk.red('Shell integration script not found in package.'));
      return;
    }

    // Ensure repty directory exists
    if (!fs.existsSync(reptyDir)) {
      fs.mkdirSync(reptyDir, { recursive: true });
    }

    // Copy script to ~/.repty/shell-integration.sh
    const scriptContent = fs.readFileSync(shellIntegrationPath, 'utf-8');
    fs.writeFileSync(targetScriptPath, scriptContent);
    
    // Detect shell and config file
    const shell = process.env.SHELL || '';
    let configFile = '';
    
    if (shell.includes('zsh')) {
      configFile = path.join(os.homedir(), '.zshrc');
    } else if (shell.includes('bash')) {
      configFile = path.join(os.homedir(), '.bashrc');
      // On macOS, bash sometimes uses .bash_profile
      if (process.platform === 'darwin' && !fs.existsSync(configFile)) {
        configFile = path.join(os.homedir(), '.bash_profile');
      }
    }

    if (!configFile) {
      console.log(chalk.yellow('Could not automatically detect shell configuration file.'));
      console.log('Please add the following line manually to your shell profile:');
      console.log(chalk.cyan(`source ${targetScriptPath}`));
      return;
    }

    const sourceLine = `\n# Repty shell integration\n[[ -f ${targetScriptPath} ]] && source ${targetScriptPath}\n`;
    
    try {
      const currentConfig = fs.existsSync(configFile) ? fs.readFileSync(configFile, 'utf-8') : '';
      
      if (currentConfig.includes(targetScriptPath)) {
        console.log(chalk.green(`✓ Repty is already configured in ${configFile}`));
      } else {
        fs.appendFileSync(configFile, sourceLine);
        console.log(chalk.green(`✓ Added shell integration to ${configFile}`));
      }
      
      console.log(chalk.cyan('\n🚀 Setup complete!'));
      console.log(chalk.yellow(`Please run: source ${configFile}`));
      console.log(chalk.gray('(Or just open a new terminal tab)'));
    } catch (err: any) {
      console.error(chalk.red(`Failed to update ${configFile}: ${err.message}`));
      console.log('Please add the following line manually:');
      console.log(chalk.cyan(`source ${targetScriptPath}`));
    }
  });

// Handle the case where repty is called from shell hook
if (process.argv[2] === '__capture__') {
  // This is called by the shell hook
  (async () => {
    const command = process.argv[3];
    const exitCode = parseInt(process.argv[4] || '0');
    const directory = process.argv[5] || process.cwd();
    
    if (command && command.trim()) {
      const config = getConfig();
      
      if (!shouldExcludeCommand(command, config)) {
        const db = new CommandDatabase(config.dbPath);
        try {
          await db.init();
          db.insertCommand({
            command: command.trim(),
            timestamp: Date.now(),
            directory,
            exitCode
          });
        } finally {
          db.close();
        }
      }
    }
  })();
} else {
  program.parse();
}
