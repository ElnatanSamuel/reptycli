declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[] | Record<string, any>): void;
    exec(sql: string, params?: any[] | Record<string, any>): QueryExecResult[];
    prepare(sql: string, params?: any[] | Record<string, any>): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export interface Statement {
    bind(values?: any[] | Record<string, any>): boolean;
    step(): boolean;
    get(params?: any[] | Record<string, any>): any[];
    getColumnNames(): string[];
    getAsObject(params?: any[] | Record<string, any>): Record<string, any>;
    run(values?: any[] | Record<string, any>): void;
    reset(): void;
    freemem(): void;
    free(): boolean;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array | number[]) => Database;
  }

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}
