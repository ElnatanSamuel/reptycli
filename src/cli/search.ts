import { CommandDatabase, SearchFilters } from '../database/db';
import { NLPParser } from '../nlp/parser';
import { CommandMatcher } from '../nlp/matcher';
import { formatCommandList } from '../utils/formatter';
import { getConfig } from '../utils/config';

export async function searchCommand(query: string): Promise<void> {
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

    // Display results
    console.log(formatCommandList(relevantCommands, true));
  } finally {
    db.close();
  }
}
