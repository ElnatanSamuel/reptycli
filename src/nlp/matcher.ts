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
  filterRelevant(scoredCommands: ScoredCommand[], parsedQuery: ParsedQuery): ScoredCommand[] {
    if (scoredCommands.length === 0) return [];

    // If query has specific command type or action, favor commands that match at least one of those strongly
    const hasPrimaryCriteria = parsedQuery.commandType || parsedQuery.action;
    const topScore = scoredCommands[0].score;
    
    return scoredCommands.filter(cmd => {
      // Basic threshold
      if (cmd.score < 5) return false;

      // If user specified "git push", don't show "git status" even if it has a high score from "git"
      if (hasPrimaryCriteria) {
        const cmdLower = cmd.command.toLowerCase();
        const matchesType = parsedQuery.commandType && cmdLower.startsWith(parsedQuery.commandType);
        const matchesAction = parsedQuery.action && cmdLower.includes(parsedQuery.action);
        
        // If we have both type and action in query (e.g. "git push"), 
        // we should really prioritize commands matching the action.
        if (parsedQuery.action && !matchesAction) {
          return false; // Filter out if action is missing
        }
      }

      // Dynamic threshold: exclude items that are significantly worse than the best match
      // But only if we have a very strong match (> 80)
      if (topScore > 80 && cmd.score < topScore * 0.6) {
        return false;
      }

      return true;
    });
  }
}
