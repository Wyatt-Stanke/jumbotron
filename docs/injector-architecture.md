# Injector Architecture

This document provides a detailed explanation of how the Jumbotron injector system works, including its stages, internal mechanisms, and the flow of data through the system.

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Injector Stages](#injector-stages)
4. [Core Components](#core-components)
5. [Mod Format](#mod-format)
6. [Action System](#action-system)
7. [Substitution Primitives](#substitution-primitives)
8. [Pattern Matching](#pattern-matching)
9. [Examples](#examples)

## Overview

The Jumbotron injector is a code transformation system that operates on Abstract Syntax Trees (ASTs) to modify GameMaker-generated JavaScript at runtime. It uses Babel for parsing and code generation, enabling surgical modifications to obfuscated game code without requiring source access.

### Key Features

- **AST-based matching**: Target specific code patterns in the game's JavaScript
- **Declarative mod format**: Define transformations using JSON
- **Single-pass traversal**: Efficient processing of multiple mods simultaneously
- **Tag-based targeting**: Mark and reference specific AST nodes across patterns
- **Substitution primitives**: Generate unique identifiers and parse code expressions
- **Type-safe actions**: Well-defined set of transformation operations

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Web Worker                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Mod JSON   │───>│   Injector   │───>│  Modified    │  │
│  │   Mods List  │    │     Core     │    │  JavaScript  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         │                    │                    │          │
│         v                    v                    v          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Babel Parser & Generator                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              v
                    ┌──────────────────┐
                    │   Blob URL       │
                    │   Game Execution │
                    └──────────────────┘
```

### Component Flow

1. **App**: User selects mods in the web interface
2. **Web Worker**: Isolated execution environment receives mod list
3. **Injector Core**: Fetches and processes game JavaScript
4. **Parser**: Converts JavaScript to AST
5. **Traversal Engine**: Applies mod filters in single pass
6. **Action Processor**: Executes transformations on matched nodes
7. **Generator**: Converts modified AST back to JavaScript
8. **Blob URL**: Creates executable URL for modified code

## Injector Stages

The injection process follows a well-defined pipeline with multiple stages:

### Stage 1: Initialization and Fetching

**Location**: `createHooks()` function start  
**Purpose**: Load and prepare game code

```typescript
const js = await fetch(url).then((res) => res.text());
const ast = parseJS(js);
```

**Steps**:
1. Fetch raw JavaScript from game URL
2. Parse JavaScript into AST using Babel
3. Initialize mod processing state

**Duration**: Network-dependent (typically 100-500ms)

### Stage 2: Filter Organization

**Location**: Filter grouping logic  
**Purpose**: Optimize traversal by grouping filters by AST node type

```typescript
const filtersByType = mods
    .flatMap((mod, modIndex) =>
        mod.filters.flat().map((filter, filterIndex) => 
            ({ mod, modIndex, filter, filterIndex })
        )
    )
    .reduce((map, { mod, modIndex, filter, filterIndex }) => {
        const nodeType = filter.selector!.type as string;
        if (!map[nodeType]) map[nodeType] = [];
        map[nodeType].push({ modIndex, filterIndex, modId: mod.id, 
                            selector: filter.selector!, actions: filter.actions });
        return map;
    }, {});
```

**Optimization**: Instead of traversing the AST once per mod filter, all filters are grouped by the AST node type they target. This enables a single-pass traversal where each node is checked against all relevant filters simultaneously.

**Example**: If 3 mods target `FunctionDeclaration` nodes and 2 target `VariableDeclarator` nodes, the system creates two groups and processes all `FunctionDeclaration` filters together when encountering each function in the AST.

### Stage 3: AST Traversal and Pattern Matching

**Location**: `traverse()` call with visitor pattern  
**Purpose**: Find nodes matching mod selectors

```typescript
const visitor = Object.fromEntries(
    Object.entries(filtersByType).map(([nodeType, filterList]) => [
        nodeType,
        (nodePath: NodePath) => {
            // Check each filter for this node type
            for (const { selector, actions } of filterList) {
                const result = checkLevel(tnode, tnode, selector);
                if (result.result) {
                    // Apply actions to matched node
                }
            }
        },
    ])
);

traverse(ast, visitor);
```

**Process**:
1. Babel traverses AST depth-first
2. For each node, checks if its type has registered filters
3. Runs pattern matching against node structure
4. Collects tagged sub-nodes for action application
5. Executes actions on matched patterns

**Pattern Matching**: Uses `checkLevel()` recursive algorithm to match nested object structures, array patterns (with `Contains` operator), and primitive values.

### Stage 4: Action Application

**Location**: `applyAction()` function  
**Purpose**: Execute transformations on matched nodes

```typescript
function applyAction(context: Context, action: Action, finalItem: any, node: Node) {
    switch (action.type) {
        case Actions.Delete:
            // Remove node from parent
            break;
        case Actions.ReplaceProperty:
            // Modify node property
            break;
        case Actions.AddArrayElement:
            // Insert element into array
            break;
    }
}
```

**Action Types**:
- **Delete**: Remove node from AST
- **ReplaceProperty**: Change specific property value
- **AddArrayElement**: Insert new node into array (start or end)
- **ReplaceSelf**: Replace entire node (future)

**Primitives Processing**: Before applying actions, the system processes substitution primitives to generate unique identifiers and parse code expressions.

### Stage 5: Program-Level Actions

**Location**: After traversal completion  
**Purpose**: Apply actions to the AST root (program node)

```typescript
for (const { mod, action } of programActions) {
    applyAction({ modId: mod.id }, action, "body", ast.program);
}
```

**Use Case**: Adding new top-level functions or statements to the program body.

### Stage 6: Code Generation

**Location**: `generate()` call  
**Purpose**: Convert modified AST back to JavaScript

```typescript
const code = `${generate(ast)};window.GameMaker_Init()`;
```

**Output**: Executable JavaScript string with all modifications applied, ready for browser execution.

## Core Components

### 1. Pattern Matcher (`checkLevel`)

Recursively matches AST node structures against selector patterns.

**Features**:
- Object property matching (exact values)
- Nested structure traversal
- Array pattern matching with `Contains` operator
- Tag collection for action targeting

**Algorithm**:
```
checkLevel(node, filter):
    if filter is object:
        for each (key, value) in filter:
            if node[key] doesn't match value:
                return false
        collect tags if present
        return true
    if filter is array with Contains:
        for each item in node array:
            if checkLevel(item, pattern):
                return true
        return false
```

### 2. Tag System

Tags mark specific AST nodes for action application.

**Symbol**: `TagSymbol` (JavaScript Symbol for uniqueness)
**Structure**: `{ [TagSymbol]: { inner: number | string } }`

**Usage**:
```json
{
    "selector": {
        "type": "FunctionDeclaration",
        "id": {
            "name": "targetFunction",
            "_tag": 1
        }
    },
    "actions": {
        "1": [{ "type": "Actions_Delete" }]
    }
}
```

The `_tag: 1` marks the `id` node, and `actions["1"]` applies to that tagged node.

### 3. Path Navigation

Converts tag paths to actual AST node references.

```typescript
function followTagPath(basePath: NodePath, tagPath: (string | number)[]): NodePath {
    let currentPath = basePath;
    for (const key of tagPath) {
        currentPath = typeof key === "number" 
            ? currentPath[key] 
            : currentPath.get(key);
    }
    return currentPath;
}
```

Enables actions to target deeply nested nodes within matched patterns.

## Mod Format

Mods use a declarative JSON format with three main components:

### Structure

```typescript
interface Mod {
    name: string;          // Display name
    id: string;            // Unique identifier
    filters: Filter[][];   // Transformation rules
}

interface Filter {
    selector?: FilterObject;           // Pattern to match
    actions: {
        [tagNumber: number]: Action[]; // Actions per tag
        program?: Action[];            // Program-level actions
    };
}
```

### Selector Syntax

Selectors mirror Babel AST node structure:

```json
{
    "type": "VariableDeclarator",
    "init": {
        "type": "ObjectExpression",
        "properties": [
            "Contains",
            {
                "key": { "name": "targetKey" },
                "value": { "value": "targetValue" },
                "_tag": 1
            }
        ]
    }
}
```

**Special Operators**:
- `"Contains"`: Array wildcard - matches if any element matches the pattern
- `"_tag"`: Marks node for action targeting (converted to `TagSymbol` internally)

## Action System

### Delete Action

Removes node from parent structure.

```json
{
    "type": "Actions_Delete"
}
```

**Use Case**: Remove unwanted code (analytics, ads, etc.)

### ReplaceProperty Action

Changes a specific property of a matched node.

```json
{
    "type": "Actions_ReplaceProperty",
    "property": "name",
    "value": "newFunctionName"
}
```

**Use Case**: Rename functions, change values, modify identifiers

### AddArrayElement Action

Inserts new element into an array node.

```json
{
    "type": "Actions_AddArrayElement",
    "position": "end",
    "element": {
        "type": "FunctionExpression",
        "id": { "type": "Identifier", "name": "myFunction" },
        "params": [],
        "body": {
            "type": "BlockStatement",
            "body": []
        }
    }
}
```

**Positions**:
- `"start"`: Insert at beginning (unshift)
- `"end"`: Insert at end (push, default)

**Use Case**: Add new functions, inject code into existing arrays

### ReplaceSelf Action (Future)

Replace entire matched node with new structure.

```json
{
    "type": "Actions_ReplaceSelf",
    "value": { ... }
}
```

**Status**: Defined but not fully implemented in action handler

## Substitution Primitives

Primitives generate dynamic values during action application.

### UniqueSafeString

Generates JavaScript-safe unique identifiers.

**Syntax**: `__Primitives_UniqueSafeString,yourIdentifier__`

**Processing**:
```typescript
function applyUniqueSafeStringPrimitive(context: Context, p1: string): string {
    const [, x] = p1.split(",");
    return `$$JUMBOTRON$$_uniqueString_${makeStringJavascriptSafe(context.modId)}_${makeStringJavascriptSafe(x)}`;
}
```

**Output**: `$$JUMBOTRON$$_uniqueString_myMod_myIdentifier`

**Use Case**: Avoid name collisions when adding new functions/variables

### ParseJSExpression

Parses JavaScript code string into AST node.

**Syntax**: 
```json
{
    "Primitives_ParseJSExpression": "myVariable + 5"
}
```

**Processing**:
```typescript
function applyParseJSExpressionPrimitive(context: Context, p1: string): Record<any, any> {
    const [, x] = p1.split("$");
    return parseJSExpression(x);
}
```

**Output**: Full AST representation of the expression

**Use Case**: Inject complex expressions without manually building AST structure

## Pattern Matching

### Object Matching

Matches all specified properties exactly:

```json
{
    "type": "Identifier",
    "name": "targetName"
}
```

Matches only identifiers with name `"targetName"`.

### Array Matching with Contains

Searches array for any element matching pattern:

```json
{
    "elements": [
        "Contains",
        { "type": "StringLiteral", "value": "target" }
    ]
}
```

Matches any array containing a string literal with value `"target"`.

### Nested Matching

Recursively matches nested structures:

```json
{
    "type": "CallExpression",
    "callee": {
        "type": "Identifier",
        "name": "myFunction"
    },
    "arguments": [
        "Contains",
        {
            "type": "NumericLiteral",
            "value": 42
        }
    ]
}
```

Matches calls to `myFunction` where one argument is the number `42`.

### Tag Collection

During matching, tagged nodes' paths are collected:

```typescript
const result = checkLevel(node, selector);
// result.tags = { 1: ["properties", 0, "key"], 2: ["init", "body"] }
```

These paths are used to navigate from the matched node to the specific tagged sub-node for action application.

## Examples

### Example 1: Remove Analytics

**Goal**: Delete Poki SDK integration

```json
{
    "name": "Jettison Poki",
    "id": "jettison-poki",
    "filters": [[{
        "selector": {
            "type": "VariableDeclarator",
            "init": {
                "type": "ObjectExpression",
                "properties": [
                    "Contains",
                    {
                        "key": { "name": "Extensions" },
                        "value": {
                            "type": "ArrayExpression",
                            "elements": [
                                "Contains",
                                {
                                    "type": "ObjectExpression",
                                    "properties": [
                                        "Contains",
                                        {
                                            "key": { "value": "name" },
                                            "value": { "value": "Poki" },
                                            "_tag": 1
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "actions": {
            "1": [{ "type": "Actions_Delete" }]
        }
    }]]
}
```

**Process**:
1. Matches variable declarators with object initializers
2. Searches for `Extensions` property containing array
3. Finds array element with `name: "Poki"`
4. Tags that object element
5. Deletes the tagged Poki object

### Example 2: Add Custom Function

**Goal**: Inject version display function

```json
{
    "name": "Show Jumbotron Version",
    "id": "show-jumbotron-version",
    "filters": [[
        {
            "selector": {
                "type": "FunctionDeclaration",
                "id": {
                    "name": "gml_Script_s_get_gm_version",
                    "_tag": 1
                }
            },
            "actions": {
                "1": [{
                    "type": "Actions_ReplaceProperty",
                    "property": "name",
                    "value": "__jumbotron_orig__Primitives_UniqueSafeString$1__$$gml_Script_s_get_gm_version"
                }]
            }
        },
        {
            "actions": {
                "program": [{
                    "type": "Actions_AddArrayElement",
                    "position": "end",
                    "element": {
                        "type": "FunctionDeclaration",
                        "id": {
                            "type": "Identifier",
                            "name": "gml_Script_s_get_gm_version"
                        },
                        "params": [],
                        "body": {
                            "type": "BlockStatement",
                            "body": [
                                {
                                    "type": "ReturnStatement",
                                    "argument": {
                                        "type": "StringLiteral",
                                        "value": "Jumbotron v0.0.1"
                                    }
                                }
                            ]
                        }
                    }
                }]
            }
        }
    ]]
}
```

**Process**:
1. First filter: Renames original `gml_Script_s_get_gm_version` to unique name
2. Second filter: Adds new function with same original name
3. New function returns custom version string
4. Game calls new function, which can delegate to original if needed

### Example 3: Property Replacement

**Goal**: Change boolean flag value

```json
{
    "selector": {
        "type": "ObjectExpression",
        "properties": [
            "Contains",
            {
                "key": { "name": "debugMode" },
                "value": { "_tag": 1, "value": false }
            }
        ]
    },
    "actions": {
        "1": [{
            "type": "Actions_ReplaceProperty",
            "property": "value",
            "value": true
        }]
    }
}
```

**Process**:
1. Finds object with `debugMode` property
2. Tags the current value node
3. Replaces the `value` property from `false` to `true`

## Performance Considerations

### Single-Pass Traversal

The injector groups all filters by node type and processes them in a single AST traversal. This is crucial for performance with many mods.

**Complexity**: O(n × m) where n = AST nodes, m = average filters per node type  
**Alternative**: O(n × f) where f = total filters (much slower)

### Memory Usage

- AST is loaded entirely in memory
- Typical game file: 1-5 MB source → 50-200 MB AST
- Modifications happen in-place
- Generated code is similar size to original

### Optimization Tips

1. **Specific selectors**: More specific patterns reduce false matches
2. **Minimize filters**: Combine related transformations
3. **Use program actions**: For adding top-level code
4. **Tag efficiently**: Only tag nodes you'll modify

## Debugging

### Noisy Mode

Enable verbose logging in `hook.ts`:

```typescript
const noisy = true;  // Line 83
```

Output shows all pattern matching attempts and failures.

### Loading State Callbacks

Track mod application progress:

```typescript
loadingStateCallback({
    type: "filterApplied",
    modId: "my-mod",
    filterIndex: 0
});
```

States: `started`, `modStarting`, `filterApplied`, `filterFailed`, `modFinished`

### Node Summary

Helper function shows node information:

```typescript
nodeSummary(node)  // "[FunctionDeclaration gml_Script_myFunc 1234:5678]"
```

## Future Enhancements

1. **ReplaceSelf action**: Full node replacement
2. **Conditional actions**: Apply based on runtime checks
3. **Multi-file mods**: Transform multiple game files
4. **Source maps**: Map modified code to original
5. **Hot reload**: Reapply mods without page refresh
6. **Mod dependencies**: Define load order and requirements
7. **Validation**: Type-check selectors against AST schema

## References

- [Babel Parser](https://babeljs.io/docs/babel-parser)
- [Babel Traverse](https://github.com/babel/babel/tree/main/packages/babel-traverse)
- [Babel Types](https://babeljs.io/docs/babel-types)
- [AST Explorer](https://astexplorer.net/) - Visualize JavaScript AST
- [GameMaker HTML5 Export](https://manual.yoyogames.com/Settings/HTML5.htm)
