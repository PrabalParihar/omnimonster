import ora, { Ora } from 'ora';
import chalk from 'chalk';

export class SpinnerManager {
  private static instance: SpinnerManager;
  private spinners: Map<string, Ora> = new Map();

  static getInstance(): SpinnerManager {
    if (!SpinnerManager.instance) {
      SpinnerManager.instance = new SpinnerManager();
    }
    return SpinnerManager.instance;
  }

  start(id: string, text: string): Ora {
    const spinner = ora({
      text: chalk.blue(text),
      color: 'blue',
      spinner: 'dots'
    }).start();
    
    this.spinners.set(id, spinner);
    return spinner;
  }

  update(id: string, text: string) {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.text = chalk.blue(text);
    }
  }

  succeed(id: string, text?: string) {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.succeed(text ? chalk.green(text) : undefined);
      this.spinners.delete(id);
    }
  }

  fail(id: string, text?: string) {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.fail(text ? chalk.red(text) : undefined);
      this.spinners.delete(id);
    }
  }

  warn(id: string, text?: string) {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.warn(text ? chalk.yellow(text) : undefined);
      this.spinners.delete(id);
    }
  }

  info(id: string, text?: string) {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.info(text ? chalk.blue(text) : undefined);
      this.spinners.delete(id);
    }
  }

  stop(id: string) {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.stop();
      this.spinners.delete(id);
    }
  }

  stopAll() {
    for (const [id, spinner] of this.spinners) {
      spinner.stop();
    }
    this.spinners.clear();
  }
}

export const spinner = SpinnerManager.getInstance();