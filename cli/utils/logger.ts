import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static level: LogLevel = LogLevel.INFO;
  private static prefix: string = '';

  static setLevel(level: LogLevel) {
    Logger.level = level;
  }

  static setPrefix(prefix: string) {
    Logger.prefix = prefix;
  }

  static debug(...args: any[]) {
    if (Logger.level <= LogLevel.DEBUG) {
      console.log(chalk.gray(`[DEBUG]${Logger.prefix}`), ...args);
    }
  }

  static info(...args: any[]) {
    if (Logger.level <= LogLevel.INFO) {
      console.log(chalk.blue(`[INFO]${Logger.prefix}`), ...args);
    }
  }

  static success(...args: any[]) {
    if (Logger.level <= LogLevel.INFO) {
      console.log(chalk.green(`[SUCCESS]${Logger.prefix}`), ...args);
    }
  }

  static warn(...args: any[]) {
    if (Logger.level <= LogLevel.WARN) {
      console.warn(chalk.yellow(`[WARN]${Logger.prefix}`), ...args);
    }
  }

  static error(...args: any[]) {
    if (Logger.level <= LogLevel.ERROR) {
      console.error(chalk.red(`[ERROR]${Logger.prefix}`), ...args);
    }
  }

  static table(data: any[], headers?: string[]) {
    if (Logger.level <= LogLevel.INFO) {
      if (headers) {
        console.table(data, headers);
      } else {
        console.table(data);
      }
    }
  }

  static json(obj: any, label?: string) {
    if (Logger.level <= LogLevel.INFO) {
      if (label) {
        console.log(chalk.cyan(`[${label}]`));
      }
      console.log(JSON.stringify(obj, null, 2));
    }
  }

  static separator() {
    if (Logger.level <= LogLevel.INFO) {
      console.log(chalk.gray('─'.repeat(50)));
    }
  }

  static heading(text: string) {
    if (Logger.level <= LogLevel.INFO) {
      console.log(chalk.bold.cyan(`\n${text}`));
      console.log(chalk.gray('─'.repeat(text.length)));
    }
  }
}

export const logger = Logger;