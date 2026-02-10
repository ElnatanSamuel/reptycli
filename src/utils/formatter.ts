import chalk from 'chalk';
import { Command } from '../database/db';
import { ScoredCommand } from '../nlp/matcher';

export function formatCommand(cmd: Command | ScoredCommand, showScore: boolean = false): string {
  const date = new Date(cmd.timestamp);
  const dateStr = date.toLocaleString();
  
  let output = '';
  
  if ('score' in cmd && showScore) {
    output += chalk.gray(`[Score: ${cmd.score}] `);
  }
  
  output += chalk.blue(dateStr) + ' ';
  output += chalk.green(cmd.directory) + '\n';
  output += chalk.white.bold(cmd.command);
  
  if (cmd.exitCode !== undefined && cmd.exitCode !== 0) {
    output += ' ' + chalk.red(`(exit: ${cmd.exitCode})`);
  }
  
  return output;
}

export function formatCommandList(commands: (Command | ScoredCommand)[], showScore: boolean = false): string {
  if (commands.length === 0) {
    return chalk.yellow('No commands found.');
  }

  const output: string[] = [];
  
  output.push(chalk.bold.cyan(`\nFound ${commands.length} command(s):\n`));
  
  commands.forEach((cmd, idx) => {
    output.push(chalk.gray(`${idx + 1}. `) + formatCommand(cmd, showScore));
    output.push(''); // Empty line between commands
  });

  return output.join('\n');
}

export function formatStats(stats: { total: number; today: number; thisWeek: number }): string {
  const output: string[] = [];
  
  output.push(chalk.bold.cyan('\n📊 Command History Statistics\n'));
  output.push(chalk.white(`Total commands: ${chalk.bold(stats.total.toString())}`));
  output.push(chalk.white(`Today: ${chalk.bold(stats.today.toString())}`));
  output.push(chalk.white(`This week: ${chalk.bold(stats.thisWeek.toString())}`));
  
  return output.join('\n');
}
