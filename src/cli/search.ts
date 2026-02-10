import { CommandDatabase, SearchFilters } from '../database/db';
import { NLPParser } from '../nlp/parser';
import { CommandMatcher } from '../nlp/matcher';
import { formatCommandList, formatChainList } from '../utils/formatter';
import { getConfig } from '../utils/config';
import { ChainDetector } from '../chains/detector';
import chalk from 'chalk';

export async function searchCommand(query: string): Promise<void> {
  const config = getConfig();
  const db = new CommandDatabase(config.dbPath);
  const parser = new NLPParser();
  const matcher = new CommandMatcher();

  await db.init();

  try {
    // Parse the natural language query
    const parsedQuery = parser.parse(query);

    // Detect project root
    const currentDir = process.cwd();
    const projectRoot = db.findProjectRoot(currentDir);
    
    // Build search filters
    const filters: SearchFilters = {
      startDate: parsedQuery.startDate,
      endDate: parsedQuery.endDate,
      commandType: parsedQuery.commandType,
      keywords: parser.extractKeywords(parsedQuery),
      directory: currentDir,
      projectRoot: projectRoot || undefined
    };

    if (projectRoot && projectRoot !== currentDir) {
      console.log(chalk.dim(`  Project detected: ${projectRoot}\n`));
    }

    // Search database for single commands
    const commands = db.searchCommands(filters, config.maxResults);

    // Find chains
    const detector = new ChainDetector(db);
    const chains = detector.findChainsForQuery(query);

    // Rank results
    const rankedCommands = matcher.rankCommands(commands, parsedQuery);
    const relevantCommands = matcher.filterRelevant(rankedCommands, parsedQuery);

    // Display results
    console.log(formatCommandList(relevantCommands, true));
    
    if (chains.length > 0) {
      console.log(formatChainList(chains.slice(0, 3)));
    }
  } finally {
    db.close();
  }
}
