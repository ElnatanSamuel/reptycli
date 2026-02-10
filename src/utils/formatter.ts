import chalk from 'chalk';
import { Command } from '../database/db';
import { ScoredCommand } from '../nlp/matcher';

export function formatCommand(cmd: Command | ScoredCommand, showScore: boolean = false): string {
  const date = new Date(cmd.timestamp);
  const dateStr = date.toLocaleString();
  
  let output = '';
  
  if ('score' in cmd && showScore) {
    output += chalk.dim(`[Score: ${cmd.score}] `);
  }
  
  output += chalk.dim(`${dateStr} • ${cmd.directory}\n`);
  output += `  ${chalk.white.bold(cmd.command)}`;
  
  if (cmd.exitCode !== undefined && cmd.exitCode !== 0) {
    output += ' ' + chalk.red(`(exit: ${cmd.exitCode})`);
  }
  
  return output;
}

export function formatCommandList(commands: (Command | ScoredCommand)[], showScore: boolean = false): string {
  if (commands.length === 0) {
    return chalk.yellow('  No commands found.');
  }

  const output: string[] = [];
  
  output.push(chalk.bold.cyan(`\n  Found ${commands.length} command(s):\n`));
  
  commands.forEach((cmd, idx) => {
    output.push(chalk.dim(`  ${idx + 1}. `) + formatCommand(cmd, showScore));
  });

  return output.join('\n\n');
}

export function formatStats(stats: { total: number; today: number; thisWeek: number }): string {
  const output: string[] = [];
  
  output.push(chalk.bold.cyan('\n  📊 History Statistics\n'));
  output.push(chalk.white(`  Total:     ${chalk.bold(stats.total.toString())}`));
  output.push(chalk.white(`  Today:     ${chalk.bold(stats.today.toString())}`));
  output.push(chalk.white(`  This week: ${chalk.bold(stats.thisWeek.toString())}`));
  
  return output.join('\n');
}

export function formatChain(commands: string[], score?: number): string {
  let output = '';
  if (score !== undefined) {
    output += chalk.dim(`[Chain Score: ${score}] `);
  }
  output += chalk.yellow.bold('⛓ Sequence') + '\n';
  output += commands.map((cmd, i) => {
    const icon = i === commands.length - 1 ? '  └─' : '  ├─';
    return chalk.white(`${icon} ${cmd}`);
  }).join('\n');
  return output;
}

export function formatChainList(chains: { commands: string[]; score: number }[]): string {
  if (chains.length === 0) return '';

  const output: string[] = [];
  output.push(chalk.bold.yellow(`\n  🔗 Suggested Sequences:\n`));
  
  chains.forEach((chain, idx) => {
    output.push(chalk.dim(`  ${idx + 1}. `) + formatChain(chain.commands, chain.score));
  });

  return output.join('\n\n');
}
