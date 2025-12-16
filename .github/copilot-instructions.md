# Repository Instructions for GitHub Copilot Coding Agent

## Project Overview

Jumbotron is a monorepo-based modding framework for GameMaker HTML5 games, specifically designed for Retro Bowl. The project enables runtime code injection and modification through AST (Abstract Syntax Tree) manipulation using Babel.

## Project Architecture

### Workspace Structure
This is an npm workspace monorepo with the following packages:
- **app**: Vite-based web application (TypeScript + Vite)
- **parser**: Babel-based JavaScript/TypeScript parser
- **modkit**: High-level API for creating game mods
- **injector/injector-core**: Core injection engine
- **injector/injector-mod-format**: Mod format type definitions
- **injector/injector-symbols**: Shared symbols and types
- **typings-core**: TypeScript definitions for GameMaker APIs

### Technology Stack
- **Language**: TypeScript (ES modules)
- **Build Tools**: Vite (app), npm workspaces
- **Parser**: Babel (@babel/parser, @babel/traverse, @babel/generator)
- **Formatter/Linter**: Biome (replacing ESLint/Prettier)
- **Package Manager**: npm with workspaces
- **Node Version**: 18+ required

## Development Standards

### Code Style
- **Formatter**: Use Biome for all formatting
- **Indentation**: Tabs (configured in biome.json)
- **Quotes**: Double quotes for JavaScript/TypeScript
- **Module System**: ES modules (`"type": "module"` in package.json)
- **File Extensions**: Use `.ts` for TypeScript, include extensions in imports

### TypeScript Guidelines
- Use strict TypeScript settings (see tsconfig.json)
- Define proper types; avoid `any` unless absolutely necessary
- Use type imports with `import type` syntax
- Leverage workspace package types (e.g., `@jumbotron/parser`)

### Naming Conventions
- **Files**: kebab-case (e.g., `index.worker.ts`, `injector-core`)
- **Variables/Functions**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: camelCase (not SCREAMING_SNAKE_CASE)
- **Packages**: Scoped with `@jumbotron/` prefix

### Import Organization
- Use Biome's auto-organize imports feature
- Group imports: external packages first, then internal workspace packages, then relative imports
- Use workspace package imports: `@jumbotron/parser`, `@jumbotron/injector-core`, etc.

## Build & Test Instructions

### Setup
```bash
# Install all dependencies
npm ci

# Build all packages in dependency order
npm run build

# Build specific workspace
npm run build --workspace=app
```

### Linting & Formatting
```bash
# Format all files
npx @biomejs/biome format --write .

# Lint all files
npx @biomejs/biome lint .

# Check formatting without modifying
npx @biomejs/biome format .

# Format with VCS ignore
npx @biomejs/biome format --vcs-use-ignore-file --write .
```

### Development Workflow
```bash
# Start development server (app only)
npm run dev --workspace=app

# Build for production
npm run build

# Build for GitHub Pages deployment
npm run build:gh --workspace=app

# Preview production build
npm run preview --workspace=app
```

### Testing
- No automated test suite currently implemented
- Testing is performed manually through the app's development server
- Example mods in `modkit/*.jb.json` serve as integration test cases
- Verify mods work by running the app and loading them through the mod selection UI

## Project-Specific Guidelines

### Working with AST Manipulation
- Use the `@jumbotron/parser` package for all AST operations
- Leverage Babel's traverse API for AST traversal
- Use the fluent API from modkit for creating selectors
- Tag nodes with `TagSymbol` for cross-reference actions

### Mod Development
- Mods use JSON format with TypeScript type validation
- Each mod has: name, id, filters (selectors + actions)
- Selectors target AST nodes using pattern matching
- Actions include: Delete, Replace, Add, ReplaceProperty
- See `modkit/*.jb.json` for examples

### Injector System
- Core injection logic is in `injector/injector-core/src/hook.ts`
- Mods are applied during AST traversal
- Substitution primitives handle symbol resolution
- Web Workers are used to isolate mod execution

### Data Files
- Game files are stored in `data/raw/` (Retro Bowl) and `data/raw_co/` (College)
- `data/proxy.py` is a Python HTTP proxy for fetching game files
- `data/overwrite/` contains custom override files
- These directories are gitignored (game files not committed)

### DevKit Script
- `devkit.sh` builds a complete development environment
- Copies raw game files, applies injector output, and formats code
- Creates symlink for convenience
- Rebuilds are incremental (checks for existing devkit folder)

## File Patterns to Ignore

The following are excluded from linting/formatting (see biome.json):
- `devkit/` - Generated development kit
- `**/dist/` - Build output
- `**/data/` - Game data files
- `**/node_modules/` - Dependencies
- `**/.mypy_cache/` - Python cache
- `*.jb.json` - Mod definition files (special format)

## Dependencies Management

### Adding Dependencies
- Add to appropriate workspace's package.json
- Use `npm install <package> --workspace=<workspace-name>`
- Run `npm run build` after adding dependencies to ensure compatibility
- Avoid adding unnecessary dependencies; prefer existing tools

### Version Updates
- Renovate is configured (see renovate.json)
- Dependencies are updated automatically via PRs
- Review and test automated updates before merging

## Debugging Guidelines

### Common Issues
1. **Build Failures**: Ensure all workspaces are built in correct order (parser → injector → modkit → app)
2. **Import Errors**: Check that workspace package is built and properly referenced
3. **AST Errors**: Verify Babel parser configuration matches source type
4. **Runtime Errors**: Check browser console; issues often in web worker

### Debugging Tools
- Browser DevTools for app debugging
- `console.log` is acceptable for debugging (removed before commit)
- Use `noisy` flag in hook.ts for verbose AST matching output
- Test mods individually in the app's mod selection panel

## CI/CD

### GitHub Actions
- Workflow: `.github/workflows/static.yml`
- Builds all packages and deploys app to GitHub Pages
- Runs on push to main branch and manual workflow dispatch
- Steps: checkout → setup Node → install → build → deploy

### Pre-commit Checklist
- [ ] Run `npm run build` successfully
- [ ] Format code with Biome: `npx @biomejs/biome format --write .`
- [ ] Lint code: `npx @biomejs/biome lint .`
- [ ] Test app manually if making functional changes
- [ ] Update documentation if changing public APIs

## Acceptance Criteria for PRs

1. All packages build successfully (`npm run build`)
2. Code is formatted with Biome (no formatting errors)
3. No new linting errors introduced
4. Changes are minimal and focused on the issue
5. Workspace dependencies are correctly declared
6. Documentation updated if APIs or workflows changed
7. Manual testing performed for functional changes

## Additional Context

### GameMaker-Specific Knowledge
- Target game uses GameMaker Studio HTML5 export
- JavaScript is heavily obfuscated and minified
- Global initialization happens in `gmlInitGlobal()`
- Game uses YoYo Games' runner (html5game/RetroBowl.js)
- AST patterns match GameMaker's code generation patterns

### Mod Format Symbols
- `Contains`: Wildcard matcher for arrays/objects
- `TagSymbol`: Marks nodes for actions
- `SubstitutionPrimitives`: Template variable system
- `Actions`: Enum of available transformations

## References

- [Babel Documentation](https://babeljs.io/docs/)
- [Biome Documentation](https://biomejs.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [npm Workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)
- [GameMaker HTML5 Structure](https://manual.yoyogames.com/)

---

When in doubt, refer to existing code patterns in the repository, especially in `modkit/src/` for mod creation and `injector/injector-core/src/` for injection logic.
