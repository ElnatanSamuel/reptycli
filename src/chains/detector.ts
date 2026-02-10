import { CommandDatabase } from '../database/db';

export interface ChainCandidate {
  commands: string[];
  score: number;
}

export class ChainDetector {
  private db: CommandDatabase;

  constructor(db: CommandDatabase) {
    this.db = db;
  }

  /**
   * Detects if the current command being logged is part of a frequent chain.
   * This is called after a command is logged.
   */
  async detectAndRecord(currentCommand: string, directory: string): Promise<void> {
    const recent = this.db.getRecentCommands(10); // Look at last 10 commands
    const sameDir = recent.filter(c => c.directory === directory);

    if (sameDir.length < 2) return;

    // Time proximity: commands must be within 5 minutes of each other
    const MAX_GAP = 5 * 60 * 1000;
    
    // sameDir is ordered by timestamp DESC (recent first)
    const last3 = sameDir.slice(0, 3);
    const last2 = sameDir.slice(0, 2);

    if (last3.length === 3) {
      const gap1 = last3[0].timestamp - last3[1].timestamp;
      const gap2 = last3[1].timestamp - last3[2].timestamp;
      if (gap1 < MAX_GAP && gap2 < MAX_GAP) {
        this.db.recordChainUsage(last3.map(c => c.command).reverse());
      }
    } else if (last2.length === 2) {
      const gap = last2[0].timestamp - last2[1].timestamp;
      if (gap < MAX_GAP) {
        this.db.recordChainUsage(last2.map(c => c.command).reverse());
      }
    }
  }

  /**
   * Finds chains that match a search query.
   */
  findChainsForQuery(query: string): ChainCandidate[] {
    const chains = this.db.getFrequentChains(50);
    const results: ChainCandidate[] = [];
    const queryLower = query.toLowerCase();

    for (const chain of chains) {
      // ONLY suggest chains that have been seen more than once
      if (chain.count < 2) continue;

      const commands = chain.commandsText.split(' && ');
      
      // A chain is relevant if the query matches a command in the chain significantly.
      // We look for "primary" commands, not just any substring.
      let highestMatchScore = 0;
      let isStrictMatch = false;

      for (const cmd of commands) {
        const cmdLower = cmd.toLowerCase();
        
        // Exact command match or query is the command itself (e.g., query "git push" matches "git push origin main")
        if (cmdLower === queryLower || cmdLower.startsWith(queryLower + ' ') || cmdLower === 'git ' + queryLower) {
          highestMatchScore = Math.max(highestMatchScore, 100);
          isStrictMatch = true;
        } else if (cmdLower.includes(queryLower)) {
          // Substring match
          highestMatchScore = Math.max(highestMatchScore, 50);
        }
      }

      if (isStrictMatch || highestMatchScore >= 50) {
        let score = (chain.count * 10) + highestMatchScore;
        
        // Bonus if the query matches the last command in the sequence (the "result" of the chain)
        if (commands[commands.length - 1].toLowerCase().includes(queryLower)) {
          score += 20;
        }

        results.push({
          commands,
          score
        });
      }
    }

    // Sort by score
    return results.sort((a, b) => b.score - a.score);
  }
}
