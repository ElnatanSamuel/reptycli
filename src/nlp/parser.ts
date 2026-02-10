import * as chrono from 'chrono-node';
import { PorterStemmer, WordTokenizer } from 'natural';

export interface ParsedQuery {
  keywords: string[];
  commandType?: string;
  startDate?: Date;
  endDate?: Date;
  action?: string;
}

const COMMAND_TYPES = ['git', 'npm', 'docker', 'yarn', 'pnpm', 'cargo', 'python', 'node', 'cd', 'ls', 'mkdir', 'rm', 'cp', 'mv'];
const ACTION_KEYWORDS = ['reset', 'install', 'commit', 'push', 'pull', 'clone', 'checkout', 'merge', 'rebase', 'stash', 'log', 'status', 'diff', 'add', 'remove', 'delete', 'create', 'update', 'run', 'build', 'test', 'deploy'];

export class NLPParser {
  private tokenizer: WordTokenizer;

  constructor() {
    this.tokenizer = new WordTokenizer();
  }

  parse(query: string): ParsedQuery {
    const result: ParsedQuery = {
      keywords: []
    };

    // Parse dates using chrono
    const dateResults = chrono.parse(query);
    if (dateResults.length > 0) {
      const firstDate = dateResults[0];
      
      if (firstDate.start) {
        result.startDate = firstDate.start.date();
        
        // Set start of day for start date
        result.startDate.setHours(0, 0, 0, 0);
      }

      if (firstDate.end) {
        result.endDate = firstDate.end.date();
        
        // Set end of day for end date
        result.endDate.setHours(23, 59, 59, 999);
      } else if (result.startDate) {
        // If only one date is mentioned, treat it as a single day range
        result.endDate = new Date(result.startDate);
        result.endDate.setHours(23, 59, 59, 999);
      }

      // Remove date phrases from query for keyword extraction
      query = query.replace(firstDate.text, '');
    }

    // Tokenize remaining query
    const tokens = this.tokenizer.tokenize(query.toLowerCase()) || [];

    // Extract command type
    for (const cmdType of COMMAND_TYPES) {
      if (tokens.includes(cmdType)) {
        result.commandType = cmdType;
        break;
      }
    }

    // Extract action keywords
    for (const action of ACTION_KEYWORDS) {
      if (tokens.includes(action)) {
        result.action = action;
        break;
      }
    }

    // Extract and stem keywords (exclude common words)
    const stopWords = new Set(['what', 'when', 'where', 'how', 'did', 'i', 'use', 'used', 'command', 'commands', 'the', 'a', 'an', 'to', 'for', 'from', 'with', 'on', 'at', 'in', 'by']);
    
    const keywords = tokens
      .filter(token => !stopWords.has(token))
      .filter(token => token.length > 2)
      .map(token => PorterStemmer.stem(token));

    // Remove duplicates
    result.keywords = [...new Set(keywords)];

    return result;
  }

  /**
   * Extract the most relevant keywords for searching
   */
  extractKeywords(parsedQuery: ParsedQuery): string[] {
    const keywords: string[] = [];

    if (parsedQuery.commandType) {
      keywords.push(parsedQuery.commandType);
    }

    if (parsedQuery.action) {
      keywords.push(parsedQuery.action);
    }

    keywords.push(...parsedQuery.keywords);

    return keywords;
  }
}
