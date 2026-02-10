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

    // We look for patterns like:
    // [cmd1, cmd2]
    // [cmd1, cmd2, cmd3]
    
    // For simplicity, let's look for the last 2 and 3 commands
    const commands = sameDir.map(c => c.command).reverse(); // Oldest first
    const last3 = commands.slice(-3);
    const last2 = commands.slice(-2);

    if (last3.length === 3) {
      this.db.recordChainUsage(last3);
    }
    
    if (last2.length === 2) {
      this.db.recordChainUsage(last2);
    }
  }

  /**
   * Finds chains that match a search query.
   */
  findChainsForQuery(query: string): ChainCandidate[] {
    const chains = this.db.getFrequentChains(20);
    const results: ChainCandidate[] = [];

    for (const chain of chains) {
      const commands = chain.commandsText.split(' && ');
      // If the query matches any part of the chain or any command in it
      const matches = commands.some(cmd => 
        cmd.toLowerCase().includes(query.toLowerCase())
      ) || chain.commandsText.toLowerCase().includes(query.toLowerCase());

      if (matches) {
        results.push({
          commands,
          score: chain.count * 10 // Basic scoring
        });
      }
    }

    return results;
  }
}
