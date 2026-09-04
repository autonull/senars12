# PeTTa Examples

This directory contains MeTTa example files copied from the [PeTTa repository](https://github.com/trueagi-io/PeTTa/tree/main/examples).

These examples are used as integration tests to measure our MeTTa implementation's capabilities and compatibility with the PeTTa dialect.

## Source

- **Original repository**: [trueagi-io/PeTTa](https://github.com/trueagi-io/PeTTa)
- **Examples directory**: https://github.com/trueagi-io/PeTTa/tree/main/examples

## Usage

Run the integration test suite to evaluate all examples:

```bash
pnpm test:integration -- --testPathPattern="petta-examples"
```

Each example is executed with a maximum timeout of 1 second. A report is generated showing passed, timed-out, errored, and skipped files.
