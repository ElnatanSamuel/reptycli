import { CommandDatabase } from '../database/db';
import { getConfig } from '../utils/config';
import chalk from 'chalk';

export async function addAlias(name: string, command: string): Promise<void> {
  const config = getConfig();
  const db = new CommandDatabase(config.dbPath);
  await db.init();

  try {
    // Support "|" as a separator for manual chains
    if (command.includes('|')) {
      const parts = command.split('|').map(p => p.trim()).filter(p => p.length > 0);
      const normalizedCommand = parts.join(' && ');
      db.addAlias(name, normalizedCommand, 'chain');
      console.log(chalk.green(`✓ Sequence alias added: ${chalk.bold(name)}`));
      parts.forEach(p => console.log(chalk.gray(`  ↳ ${p}`)));
    } else {
      db.addAlias(name, command, 'single');
      console.log(chalk.green(`✓ Alias added: ${chalk.bold(name)} → ${command}`));
    }
  } finally {
    db.close();
  }
}

export async function listAliases(): Promise<void> {
  const config = getConfig();
  const db = new CommandDatabase(config.dbPath);
  await db.init();

  try {
    const aliases = db.getAllAliases();
    if (aliases.length === 0) {
      console.log(chalk.yellow('No aliases found. Add one with: repty alias add <name> <command>'));
      return;
    }

    console.log(chalk.bold('\nCommand Aliases:'));
    aliases.forEach(alias => {
      const typeLabel = alias.type === 'chain' ? chalk.yellow('[Chain]') : chalk.cyan('[Single]');
      console.log(`${chalk.bold(alias.name)} ${typeLabel} → ${alias.commandsText}`);
    });
    console.log('');
  } finally {
    db.close();
  }
}

export async function removeAlias(name: string): Promise<void> {
  const config = getConfig();
  const db = new CommandDatabase(config.dbPath);
  await db.init();

  try {
    const existing = db.getAlias(name);
    if (!existing) {
      console.log(chalk.red(`✗ Alias not found: ${name}`));
      return;
    }

    db.deleteAlias(name);
    console.log(chalk.green(`✓ Alias removed: ${name}`));
  } finally {
    db.close();
  }
}
