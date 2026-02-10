import { CommandDatabase } from '../database/db';
import { getConfig, shouldExcludeCommand } from '../utils/config';
import { ChainDetector } from '../chains/detector';
import chalk from 'chalk';

export async function logCommand(command: string, directory?: string, exitCode?: number): Promise<void> {
  const config = getConfig();
  
  // Check if command should be excluded
  if (shouldExcludeCommand(command, config)) {
    console.log(chalk.yellow('Command excluded (contains sensitive pattern)'));
    return;
  }

  const db = new CommandDatabase(config.dbPath);
  await db.init();

  try {
    const id = db.insertCommand({
      command,
      timestamp: Date.now(),
      directory: directory || process.cwd(),
      exitCode
    });

    // Detect chains
    const detector = new ChainDetector(db);
    await detector.detectAndRecord(command, directory || process.cwd());

    console.log(chalk.green(`✓ Command logged (ID: ${id})`));
  } finally {
    db.close();
  }
}
