# Jumbotron

A modding framework for GameMaker HTML5 games, specifically designed for Retro Bowl. This project provides a comprehensive system for parsing, modifying, and injecting custom code into GameMaker-generated JavaScript.

## 🎯 Project Overview

Jumbotron is a monorepo containing multiple interconnected packages that work together to enable game modding:

- **Parser**: AST parsing and manipulation using Babel
- **Injector Core**: Core injection engine for applying mods to game code
- **Injector Mod Format**: Standardized format for defining mods
- **Injector Symbols**: Shared symbols and types for the injection system
- **Modkit**: High-level API for creating mods
- **App**: Web-based frontend for loading and applying mods
- **Typings Core**: TypeScript definitions for game APIs

## 🏗️ Project Structure

```
jumbotron/
├── app/                    # Vite-based web application
│   ├── src/               # Frontend source (TypeScript)
│   ├── mods/              # Mod files location
│   └── vite.config.ts     # Vite configuration
├── parser/                # Babel-based JavaScript parser
│   └── src/index.ts       # Parse/generate JS/TS code
├── injector/              # Code injection system
│   ├── injector-core/     # Core injection logic
│   ├── injector-mod-format/  # Mod format definitions
│   └── injector-symbols/  # Shared symbols and types
├── modkit/                # Mod development kit
│   ├── src/               # Fluent API for mod creation
│   └── *.jb.json          # Example mod definitions
├── typings-core/          # TypeScript type definitions
├── data/                  # Game data and proxy server
│   ├── proxy.py           # Development proxy server
│   ├── raw/               # Retro Bowl game files
│   ├── raw_co/            # Retro Bowl College files
│   └── overwrite/         # Custom override files
└── devkit.sh             # Development kit build script
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm (v9 or later)
- Python 3 (for proxy server)

### Installation

```bash
# Clone the repository
git clone https://github.com/Wyatt-Stanke/jumbotron.git
cd jumbotron

# Install dependencies
npm ci

# Build all packages
npm run build
```

### Development Setup

1. **Fetch game files** (required for first-time setup):
   ```bash
   # Run the proxy to download game files
   python3 data/proxy.py
   ```

2. **Build the development kit**:
   ```bash
   # Creates a devkit/ folder with all necessary files
   ./devkit.sh
   ```

3. **Start the development server**:
   ```bash
   # In the app workspace
   npm run dev --workspace=app
   ```

## 🛠️ How It Works

### 1. Parsing Stage
The **parser** package uses Babel to parse GameMaker-generated JavaScript into an Abstract Syntax Tree (AST).

### 2. Mod Definition
Mods are defined using the **modkit** fluent API or JSON format. Each mod specifies:
- **Selectors**: Target specific code patterns in the AST
- **Actions**: Define transformations (delete, replace, add, etc.)
- **Tags**: Mark nodes for cross-reference actions

Example mod structure:
```typescript
{
  name: "Example Mod",
  id: "example-mod",
  filters: [
    {
      selector: f.functionDeclaration({ name: "targetFunction" }),
      actions: { 1: [{ type: Actions.Delete }] }
    }
  ]
}
```

### 3. Injection Stage
The **injector-core** traverses the AST, applies mod filters, and generates modified JavaScript:
- Matches selectors against AST nodes
- Executes defined actions (replace, delete, add)
- Handles symbol resolution and substitution
- Generates final JavaScript code

### 4. Runtime Execution
The **app** loads the modified JavaScript in a web worker and creates a blob URL for execution.

## 📦 Workspace Packages

### `@jumbotron/parser`
Babel-based parser for JavaScript/TypeScript with AST manipulation utilities.

### `@jumbotron/injector-core`
Core injection engine implementing the mod application logic.

### `@jumbotron/injector-mod-format`
Type definitions and schemas for the mod format specification.

### `@jumbotron/injector-symbols`
Shared symbols (TagSymbol, Contains) and action types used across packages.

### `@jumbotron/modkit`
High-level fluent API for creating mods with TypeScript support.

### `@jumbotron/typings-core`
TypeScript definitions for GameMaker runtime APIs.

### `app`
Vite-based web application with mod selection UI and game loader.

## 🧪 Development Commands

```bash
# Build all packages
npm run build

# Build specific workspace
npm run build --workspace=app

# Format code with Biome
npx @biomejs/biome format --write .

# Lint code with Biome
npx @biomejs/biome lint .

# Run development server
npm run dev --workspace=app

# Build for GitHub Pages
npm run build:gh --workspace=app

# Preview production build
npm run preview --workspace=app
```

## 🔧 Creating Mods

See the example mods in `modkit/`:
- `jettison-poki.jb.json` - Remove Poki SDK integration
- `override-poki.jb.json` - Override Poki functionality
- `show-jumbotron-version.jb.json` - Display Jumbotron version

Mods use a declarative JSON format with selectors and actions to transform the game code.

## 📝 Technical Notes

- Generate typing from JS: `npx tsc --declaration RetroBowl.ts`
- All of the `_inst`/`global` is set up in `gmlInitGlobal()`
- Retro Bowl College appears to be a slightly more updated version of RB
- Player "cards" are drawn in `gml_Object_obj_player_profile_Draw_64`
- Primitives are applied at parse time during injection

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to ensure everything builds
5. Submit a pull request

## 🐛 Troubleshooting

**Build fails**: Ensure you've run `npm ci` to install dependencies
**Devkit fails**: Run `python3 data/proxy.py` first to fetch game files
**App won't start**: Check that all packages are built with `npm run build`