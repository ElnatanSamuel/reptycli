import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

export interface Command {
  id?: number;
  command: string;
  timestamp: number;
  directory: string;
  exitCode?: number;
  tags?: string;
  description?: string;
}

export interface CommandChain {
  id?: number;
  commandsText: string;
  count: number;
  lastUsed: number;
}

export interface SearchFilters {
  startDate?: Date;
  endDate?: Date;
  commandType?: string;
  keywords?: string[];
  directory?: string;
}

export class CommandDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private SQL: any;

  constructor(customPath?: string) {
    const reptyDir = path.join(os.homedir(), '.repty');
    if (!fs.existsSync(reptyDir)) {
      fs.mkdirSync(reptyDir, { recursive: true });
    }

    this.dbPath = customPath || path.join(reptyDir, 'history.db');
  }

  async init(): Promise<void> {
    const sqlJsPath = require.resolve('sql.js');
    const wasmPath = path.join(path.dirname(sqlJsPath), 'sql-wasm.wasm');

    this.SQL = await initSqlJs({
      locateFile: (file: string) => wasmPath
    });
    
    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }

    this.initializeSchema();
  }

  private initializeSchema(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        directory TEXT NOT NULL,
        exit_code INTEGER,
        tags TEXT,
        description TEXT
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS command_chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commands_text TEXT NOT NULL UNIQUE,
        count INTEGER DEFAULT 1,
        last_used INTEGER NOT NULL
      );
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON commands(timestamp);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tags ON commands(tags);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_directory ON commands(directory);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_chain_usage ON command_chains(count DESC, last_used DESC);`);
  }

  insertCommand(cmd: Command): number {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT INTO commands (command, timestamp, directory, exit_code, tags, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cmd.command,
        cmd.timestamp,
        cmd.directory,
        cmd.exitCode !== undefined ? cmd.exitCode : null,
        cmd.tags !== undefined ? cmd.tags : null,
        cmd.description !== undefined ? cmd.description : null
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    
    return result[0].values[0][0] as number;
  }

  searchCommands(filters: SearchFilters, limit: number = 50): Command[] {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM commands WHERE 1=1';
    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate.getTime());
    }

    if (filters.commandType) {
      query += ' AND command LIKE ?';
      params.push(`${filters.commandType}%`);
    }

    if (filters.keywords && filters.keywords.length > 0) {
      const keywordConditions = filters.keywords.map(() => 'command LIKE ?').join(' OR ');
      query += ` AND (${keywordConditions})`;
      filters.keywords.forEach(kw => params.push(`%${kw}%`));
    }

    if (filters.directory) {
      query += ' AND directory = ?';
      params.push(filters.directory);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const result = this.db.exec(query, params);
    
    if (result.length === 0) return [];

    const columns = result[0].columns;
    const rows = result[0].values;

    return rows.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      
      return {
        id: obj.id,
        command: obj.command,
        timestamp: obj.timestamp,
        directory: obj.directory,
        exitCode: obj.exit_code,
        tags: obj.tags,
        description: obj.description
      };
    });
  }

  getRecentCommands(limit: number = 20): Command[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM commands ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const rows = result[0].values;

    return rows.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      
      return {
        id: obj.id,
        command: obj.command,
        timestamp: obj.timestamp,
        directory: obj.directory,
        exitCode: obj.exit_code,
        tags: obj.tags,
        description: obj.description
      };
    });
  }

  getStats(): { total: number; today: number; thisWeek: number } {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const totalResult = this.db.exec('SELECT COUNT(*) as count FROM commands');
    const todayResult = this.db.exec('SELECT COUNT(*) as count FROM commands WHERE timestamp >= ?', [oneDayAgo]);
    const weekResult = this.db.exec('SELECT COUNT(*) as count FROM commands WHERE timestamp >= ?', [oneWeekAgo]);

    return {
      total: totalResult[0]?.values[0]?.[0] as number || 0,
      today: todayResult[0]?.values[0]?.[0] as number || 0,
      thisWeek: weekResult[0]?.values[0]?.[0] as number || 0
    };
  }

  getFrequentChains(limit: number = 10): CommandChain[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM command_chains ORDER BY count DESC, last_used DESC LIMIT ?',
      [limit]
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const rows = result[0].values;

    return rows.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });

      return {
        id: obj.id,
        commandsText: obj.commands_text,
        count: obj.count,
        lastUsed: obj.last_used
      };
    });
  }

  recordChainUsage(commands: string[]): void {
    if (!this.db) throw new Error('Database not initialized');
    const commandsText = commands.join(' && ');

    this.db.run(
      `INSERT INTO command_chains (commands_text, count, last_used)
       VALUES (?, 1, ?)
       ON CONFLICT(commands_text) DO UPDATE SET
       count = count + 1,
       last_used = ?`,
      [commandsText, Date.now(), Date.now()]
    );
    this.save();
  }

  clearChains(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('DELETE FROM command_chains');
    this.save();
  }

  clearHistory(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('DELETE FROM commands');
    this.db.run('DELETE FROM command_chains');
    this.save();
  }

  private save(): void {
    if (!this.db) return;
    
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, data);
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
