# Biome Configuration Guide

This project uses [Biome](https://biomejs.dev/) for code formatting and linting. Biome is a fast, modern toolchain that replaces ESLint and Prettier with a single tool.

## Quick Start

### Available Commands

```bash
# Format all files
npm run format

# Check formatting without making changes
npm run format:check

# Lint and auto-fix issues
npm run lint

# Check linting without making changes
npm run lint:check

# Format and lint together (auto-fix)
npm run check

# CI mode (no fixes, strict checking)
npm run check:ci
```

## VS Code Integration

This project is configured to use Biome in VS Code:

1. **Install the Biome extension**: The project recommends the `biomejs.biome` extension
2. **Format on save**: Enabled by default in `.vscode/settings.json`
3. **Code actions**: Import organization and quick fixes are configured

## Configuration Files

### biome.json

The main configuration file includes:
- **Formatter**: Uses tabs for indentation, double quotes for strings
- **Linter**: Enabled with recommended rules plus additional strict rules
- **Overrides**: 
  - `.jb.json` files are excluded (mod definition format)
  - `data/` directory is excluded (game files)

### .biomeignore

Additional ignore patterns for:
- Build artifacts (`devkit/`, `dist/`)
- Dependencies (`node_modules/`)
- Cache directories (`.mypy_cache/`)
- Large game data files

## CI Integration

Both test and deployment workflows run `npm run check:ci` to ensure code quality:

```yaml
- name: Check formatting and linting
  run: npm run check:ci
```

This command fails if there are formatting issues or linting errors in the committed code.

## Rules and Standards

### Code Style
- **Indentation**: Tabs
- **Quotes**: Double quotes for strings
- **Line endings**: LF (handled by VCS)

### Linting Rules
- All recommended rules enabled
- Additional strict rules:
  - `noParameterAssign`: Prevent reassignment of function parameters
  - `useAsConstAssertion`: Enforce `as const` for literal types
  - `useDefaultParameterLast`: Default parameters must come last
  - `useEnumInitializers`: Enums must have initializers
  - `useSelfClosingElements`: Use self-closing JSX tags
  - `useSingleVarDeclarator`: One variable declaration per statement
  - `noUnusedTemplateLiteral`: Avoid unnecessary template literals
  - `useNumberNamespace`: Use `Number` namespace instead of globals
  - `noInferrableTypes`: Don't specify obvious types
  - `noUselessElse`: Remove unnecessary else clauses

## Troubleshooting

### "File size exceeds maximum"
Some generated files (like `typings-core/RetroBowl-raw.d.ts`) are large. The `maxSize` is set to 2MB to accommodate them.

### "Biome encountered an unexpected error"
There may be some internal Biome errors on certain files. These are Biome bugs and don't indicate issues with your code. You can safely ignore these messages.

### Excluding Files
To exclude additional files or directories:
1. Add patterns to `.biomeignore` for complete exclusion
2. Use `overrides` in `biome.json` to disable specific checkers

## Migration from ESLint/Prettier

This project has fully migrated to Biome:
- ✅ No ESLint configuration
- ✅ No Prettier configuration  
- ✅ All formatting and linting through Biome
- ✅ VS Code configured for Biome
- ✅ CI/CD uses Biome checks

## Learn More

- [Biome Documentation](https://biomejs.dev/)
- [Biome vs Other Tools](https://biomejs.dev/internals/language-support/)
- [Linter Rules Reference](https://biomejs.dev/linter/rules/)
