#!/usr/bin/env tsx

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { healthCommand } from './commands/health';
import { swapCommand } from './commands/swap';
import { poolCommand } from './commands/pool';
import { contractCommand } from './commands/contract';
import { dbCommand } from './commands/database';
import { monitorCommand } from './commands/monitor';
import { loadTestCommand } from './commands/load-test';

const program = new Command();

// Display banner
console.log(chalk.cyan(figlet.textSync('Fusion CLI', { horizontalLayout: 'full' })));
console.log(chalk.gray('Comprehensive testing tool for Fusion Swap backend architecture\n'));

program
  .name('fusion-test')
  .description('CLI tool for testing and managing Fusion Swap backend systems')
  .version('1.0.0');

// Register all command modules
program.addCommand(healthCommand);
program.addCommand(swapCommand);
program.addCommand(poolCommand);
program.addCommand(contractCommand);
program.addCommand(dbCommand);
program.addCommand(monitorCommand);
program.addCommand(loadTestCommand);

// Global error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();