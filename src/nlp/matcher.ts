import { Command } from '../database/db';
import { ParsedQuery } from './parser';
import natural from 'natural';

export interface ScoredCommand extends Command {
  score: number;
}

export class CommandMatcher {
  private tfidf: natural.TfIdf;

  constructor() {
    this.tfidf = new natural.TfIdf();
  }

  /**
   * Score and rank commands based on the parsed query
   */
  rankCommands(commands: Command[], parsedQuery: ParsedQuery): ScoredCommand[] {
    const scoredCommands: ScoredCommand[] = commands.map(cmd => ({
      ...cmd,
      score: this.calculateScore(cmd, parsedQuery)
    }));

    // Sort by score descending
    return scoredCommands.sort((a, b) => b.score - a.score);
  }

  private calculateScore(command: Command, parsedQuery: ParsedQuery): number {
    let score = 0;

    const cmdLower = command.command.toLowerCase();

    // Exact command type match (high weight)
    if (parsedQuery.commandType) {
      if (cmdLower.startsWith(parsedQuery.commandType)) {
        score += 50;
      } else if (cmdLower.includes(parsedQuery.commandType)) {
        score += 25;
      }
    }

    // Action keyword match
    if (parsedQuery.action) {
      if (cmdLower.includes(parsedQuery.action)) {
        score += 30;
      }
    }

    // Keyword matches
    for (const keyword of parsedQuery.keywords) {
      if (cmdLower.includes(keyword)) {
        score += 10;
      }
      
      // Fuzzy match using Levenshtein distance
      const words = cmdLower.split(/\s+/);
      for (const word of words) {
        const distance = natural.LevenshteinDistance(keyword, word);
        if (distance <= 2) { // Allow up to 2 character differences
          score += Math.max(0, 5 - distance);
        }
      }
    }

    // Recency bonus (more recent commands get slightly higher scores)
    const daysSinceCommand = (Date.now() - command.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceCommand < 7) {
      score += 5 - Math.floor(daysSinceCommand);
    }

    return score;
  }

  /**
   * Filter commands that don't meet minimum criteria
   */
  filterRelevant(scoredCommands: ScoredCommand[], minScore: number = 5): ScoredCommand[] {
    return scoredCommands.filter(cmd => cmd.score >= minScore);
  }
}
