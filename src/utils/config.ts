import path from 'path';
import os from 'os';

export interface Config {
  dbPath: string;
  excludePatterns: string[];
  maxResults: number;
}

export function getConfig(): Config {
  const reptyDir = path.join(os.homedir(), '.repty');
  
  return {
    dbPath: path.join(reptyDir, 'history.db'),
    excludePatterns: [
      // Exclude commands with sensitive data
      'password',
      'token',
      'secret',
      'api_key',
      'apikey',
      // Exclude repty itself to avoid meta-logging
      'repty '
    ],
    maxResults: 50
  };
}

export function shouldExcludeCommand(command: string, config: Config): boolean {
  const cmdLower = command.toLowerCase();
  
  return config.excludePatterns.some(pattern => 
    cmdLower.includes(pattern.toLowerCase())
  );
}
