import { Command } from 'commander';
import { logger } from '../utils/logger';

export const loadTestCommand = new Command('load-test')
  .description('Performance testing and benchmarks')
  .action(() => {
    logger.info('Load testing commands - use --help for available subcommands');
  });