# SeNARS12 Bot

Operational bot framework with multi-modal I/O (IRC, CLI, Demo).

## Architecture

Pure JavaScript implementation without MeTTa dependency. The bot provides:
- **IRC Server**: Embedded IRC for local testing
- **CLI Interface**: Command-line interaction
- **Demo Mode**: Web-based demo interface

## Usage

```bash
# Start with minimal profile
node run.js --profile=minimal

# Start with standard profile (IRC enabled)
node run.js --profile=standard

# Start with custom config
node run.js --config=bot.config.json
```

## Configuration

Profiles:
- `minimal`: CLI only, reduced capabilities
- `standard`: IRC + CLI, persistence enabled
- `full`: All embodiments, all capabilities

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```
