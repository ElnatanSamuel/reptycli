import { CommandDatabase, SearchFilters } from '../database/db';
import { NLPParser } from '../nlp/parser';
import { CommandMatcher } from '../nlp/matcher';
import { getConfig } from '../utils/config';
import { ChainDetector } from '../chains/detector';
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

    // Search database for single commands
    const commands = db.searchCommands(filters, config.maxResults);
    
    // Find chains
    const detector = new ChainDetector(db);
    const chains = detector.findChainsForQuery(query);

    // Rank results
    const rankedCommands = matcher.rankCommands(commands, parsedQuery);
    const relevantCommands = matcher.filterRelevant(rankedCommands);

    if (relevantCommands.length === 0 && chains.length === 0) {
      console.log(chalk.yellow('No matching commands or sequences found.'));
      return;
    }

    // Combine results for selection
    let choices: any[] = [];
    
    // Add chains first if found
    chains.slice(0, 3).forEach((chain, idx) => {
      choices.push({
        name: `${chalk.yellow('⛓ Sequence:')} ${chain.commands.join(' → ')}`,
        value: { type: 'chain', data: chain.commands }
      });
    });

    // Add single commands
    relevantCommands.slice(0, 7).forEach((cmd) => {
      choices.push({
        name: `${cmd.command} (${new Date(cmd.timestamp).toLocaleString()})`,
        value: { type: 'single', data: cmd.command }
      });
    });

    let selected: { type: string; data: any };

    if (choices.length === 1) {
      selected = choices[0].value;
    } else {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Found the following matches. Select one to run:',
          choices: choices
        }
      ]);
      selected = answer.selected;
    }

    const commandsToRun = selected.type === 'chain' ? selected.data : [selected.data];

    // Confirm execution
    const confirmMessage = selected.type === 'chain' 
      ? `Execute sequence:\n${commandsToRun.map((c: string) => `  ↳ ${c}`).join('\n')}?`
      : `Execute: ${chalk.bold(commandsToRun[0])}?`;

    const confirmAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'execute',
        message: confirmMessage,
        default: false
      }
    ]);

    if (!confirmAnswer.execute) {
      console.log(chalk.yellow('Execution cancelled.'));
      return;
    }

    // Execute the commands
    for (const cmd of commandsToRun) {
      console.log(chalk.cyan(`\nExecuting: ${cmd}\n`));
      
      try {
        const { stdout, stderr } = await execAsync(cmd);
        if (stdout) console.log(stdout);
        if (stderr) console.error(chalk.red(stderr));
        console.log(chalk.green(`✓ Done: ${cmd}`));
      } catch (error: any) {
        console.error(chalk.red(`\n✗ Command failed: ${cmd}`));
        console.error(chalk.red(`Exit code: ${error.code}`));
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(chalk.red(error.stderr));
        
        if (selected.type === 'chain') {
          const stopAnswer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continue',
              message: 'A command in the sequence failed. Continue with the rest?',
              default: false
            }
          ]);
          if (!stopAnswer.continue) break;
        }
      }
    }

    console.log(chalk.green('\n✓ Finished execution'));
  } finally {
    db.close();
  }
}
