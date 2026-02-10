#!/usr/bin/env node
import { Command } from 'commander';
import { searchCommand } from './cli/search';
import { executeCommand } from './cli/execute';
import { logCommand } from './cli/log';
import { addAlias, listAliases, removeAlias } from './cli/alias';
import { CommandDatabase } from './database/db';
import { getConfig, shouldExcludeCommand } from './utils/config';
import { formatCommandList, formatStats } from './utils/formatter';
import { ChainDetector } from './chains/detector';

import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import boxen from 'boxen';
import updateNotifier from 'update-notifier';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
updateNotifier({ pkg }).notify();

const program = new Command();

program
  .name('repty')
  .description('Terminal command history with natural language search')
  .version(pkg.version)
  .enablePositionalOptions();

program
  .command('search <query...>')
  .alias('s')
  .description('Search command history using natural language')
  .action(async (queryParts: string[]) => {
    const query = queryParts.join(' ');
    await searchCommand(query);
  });

program
  .command('run <query...>')
  .alias('r')
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
      
      if (!currentConfig.includes(targetScriptPath)) {
        fs.appendFileSync(configFile, sourceLine);
      }
      
      const message = 
        chalk.green('✓ Repty shell integration configured!') + '\n\n' +
        chalk.white('Added to: ') + chalk.cyan(configFile) + '\n\n' +
        chalk.yellow('Please run: ') + chalk.bold(`source ${configFile}`) + '\n' +
        chalk.gray('(Or just open a new terminal tab)');

      console.log('\n' + boxen(message, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: 'Setup Complete',
        titleAlignment: 'center'
      }));
    } catch (err: any) {
      console.error(chalk.red(`Failed to update ${configFile}: ${err.message}`));
      console.log('Please add the following line manually:');
      console.log(chalk.cyan(`source ${targetScriptPath}`));
    }
  });

program
  .command('clear')
  .description('Clear command history or sequences')
  .option('-s, --sequences', 'Clear only command sequences (chains)')
  .option('-a, --all', 'Clear all command history and sequences')
  .action(async (options) => {
    const config = getConfig();
    const db = new CommandDatabase(config.dbPath);
    await db.init();

    try {
      if (options.all) {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: chalk.red('Are you sure you want to clear ALL command history and sequences?'),
          default: false
        }]);
        if (answer.confirm) {
          db.clearHistory();
          console.log(chalk.green('✓ All command history and sequences cleared.'));
        }
      } else if (options.sequences) {
        db.clearChains();
        console.log(chalk.green('✓ Command sequences cleared.'));
      } else {
        console.log(chalk.yellow('Please specify what to clear:'));
        console.log('  repty clear --sequences  (Clear only chains)');
        console.log('  repty clear --all        (Clear everything)');
      }
    } finally {
      db.close();
    }
  });

const aliasPromo = program
  .command('alias [name] [command...]')
  .alias('a')
  .description('Manage command aliases')
  .passThroughOptions()
  .action(async (name, commandParts) => {
    if (name) {
      // name is provided, commandParts might be empty (which triggers interactive prompt in addAlias)
      await addAlias(name, commandParts || []);
    } else {
      // If no name, show help for the alias command group
      aliasPromo.outputHelp();
    }
  });

aliasPromo
  .command('add <name> <command...>')
  .description('Add a new command alias')
  .action(addAlias);

aliasPromo
  .command('list')
  .description('List all manual aliases')
  .action(listAliases);

aliasPromo
  .command('remove <name>')
  .description('Remove a command alias')
  .action(removeAlias);

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
          
          // Detect chains
          const detector = new ChainDetector(db);
          await detector.detectAndRecord(command.trim(), directory);
        } finally {
          db.close();
        }
      }
    }
  })();
} else {
  // Direct Alias Execution support
  const args = process.argv.slice(2);
  const possibleAlias = args[0];

  if (possibleAlias && !possibleAlias.startsWith('-') && !program.commands.some(c => c.name() === possibleAlias || c.alias() === possibleAlias)) {
    (async () => {
      const db = new CommandDatabase(getConfig().dbPath);
      await db.init();
      const alias = db.getAlias(possibleAlias);
      db.close();

      if (alias) {
        await executeCommand(possibleAlias);
        return;
      } else {
        program.parse();
      }
    })();
  } else {
    program.parse();
  }
}
