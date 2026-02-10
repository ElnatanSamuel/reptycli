import { CommandDatabase, SearchFilters } from '../database/db';
import { NLPParser } from '../nlp/parser';
import { CommandMatcher } from '../nlp/matcher';
import { getConfig } from '../utils/config';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export async function executeCommand(query: string): Promise<void> {
  const config = getConfig();
  const db = new CommandDatabase(config.dbPath);
  const parser = new NLPParser();
  const matcher = new CommandMatcher();

  await db.init();

  try {
    // Parse the natural language query
    const parsedQuery = parser.parse(query);

    // Build search filters
    const filters: SearchFilters = {
      startDate: parsedQuery.startDate,
      endDate: parsedQuery.endDate,
      commandType: parsedQuery.commandType,
      keywords: parser.extractKeywords(parsedQuery)
    };

    // Search database
    const commands = db.searchCommands(filters, config.maxResults);

    // Rank results
    const rankedCommands = matcher.rankCommands(commands, parsedQuery);
    const relevantCommands = matcher.filterRelevant(rankedCommands);

    if (relevantCommands.length === 0) {
      console.log(chalk.yellow('No matching commands found.'));
      return;
    }

    // If multiple results, let user choose
    let selectedCommand = relevantCommands[0];

    if (relevantCommands.length > 1) {
      const choices = relevantCommands.slice(0, 10).map((cmd, idx) => ({
        name: `${cmd.command} (${new Date(cmd.timestamp).toLocaleString()})`,
        value: idx
      }));

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'commandIndex',
          message: 'Multiple commands found. Select one:',
          choices: choices
        }
      ]);

      selectedCommand = relevantCommands[answer.commandIndex];
    }

    // Confirm execution
    const confirmAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'execute',
        message: `Execute: ${chalk.bold(selectedCommand.command)}?`,
        default: false
      }
    ]);

    if (!confirmAnswer.execute) {
      console.log(chalk.yellow('Execution cancelled.'));
      return;
    }

    // Execute the command
    console.log(chalk.cyan(`\nExecuting: ${selectedCommand.command}\n`));
    
    try {
      const { stdout, stderr } = await execAsync(selectedCommand.command);
      
      if (stdout) {
        console.log(stdout);
      }
      
      if (stderr) {
        console.error(chalk.red(stderr));
      }
      
      console.log(chalk.green('\n✓ Command executed successfully'));
    } catch (error: any) {
      console.error(chalk.red(`\n✗ Command failed with exit code ${error.code}`));
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(chalk.red(error.stderr));
    }
  } finally {
    db.close();
  }
}
