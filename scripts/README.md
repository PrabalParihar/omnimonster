# Scripts Directory

This directory contains various utility, debug, and test scripts for the Swap Sage project.

## Directory Structure

### `/debug`
Contains debugging and checking scripts:
- `check-*.ts` - Scripts for checking various system states
- `debug-*.ts` - Debug utilities for troubleshooting
- `find-*.ts` - Scripts to find specific data or transactions
- `verify-*.ts` - Verification scripts for contracts and swaps

### `/test`
Contains test scripts:
- `test-*.ts` - Various test scenarios for swaps, claims, and HTLCs
- `complete-swap-flow-test.ts` - End-to-end swap flow testing

### `/utilities`
Contains utility scripts:
- `add-*.ts` - Scripts for adding liquidity or other resources
- `execute-*.ts` - Scripts for executing claims and transactions
- `claim-*.ts` - Claim helper scripts
- `deploy-*.ts` - Deployment scripts
- `generate-*.ts` - Generation utilities

### `/fixes`
Contains fix and cleanup scripts:
- `fix-*.ts` - Scripts to fix specific issues
- `update-*.ts` - Update scripts for swaps and data
- `reset-*.ts` - Reset scripts
- `clean-*.ts` - Cleanup utilities

## Usage

Most scripts can be run using:
```bash
npx tsx scripts/{directory}/{script-name}.ts
```

## Note
These scripts were moved from the root directory to keep the project organized. They are primarily for development and debugging purposes.