import { Command } from 'commander';
import { logger } from '../utils/logger';

export const monitorCommand = new Command('monitor')
  .description('System monitoring and metrics')
  .action(() => {
    logger.info('System monitoring commands - use --help for available subcommands');
  });