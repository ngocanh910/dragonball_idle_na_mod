#!/usr/bin/env node

// ============================================================
// Game Data Explorer
// A CLI tool to explore the 434 game JSON data files.
//
// Usage:
//   node tools/data-explorer.js list              # list all collections
//   node tools/data-explorer.js stats             # entry counts
//   node tools/data-explorer.js show hero         # first 5 entries
//   node tools/data-explorer.js find hero 1       # find by id
//   node tools/data-explorer.js search hero Name  # full text search
// ============================================================

const path = require('path');

// Use the game-data module
process.env.NODE_PATH = path.resolve(__dirname, '..');
const gameData = require('../game-data');

const [, , command, ...args] = process.argv;

switch (command) {
  // ── List collections ──────────────────────────────────────
  case 'list':
  case 'collections': {
    const cols = gameData.collections();
    console.log(`\n${cols.length} collections:\n`);
    cols.sort().forEach((c) => console.log(`  ${c}`));
    break;
  }

  // ── Stats ─────────────────────────────────────────────────
  case 'stats': {
    const stats = gameData.stats();
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    console.log(`\nTotal entries: ${total.toLocaleString()}\n`);
    const sorted = Object.entries(stats).sort(([, a], [, b]) => b - a);
    sorted.forEach(([name, count]) => {
      console.log(`  ${name.padEnd(30)} ${count.toLocaleString().padStart(8)}`);
    });
    break;
  }

  // ── Show first N entries ──────────────────────────────────
  case 'show':
  case 'peek': {
    const name = args[0];
    const limit = parseInt(args[1], 10) || 5;
    const data = gameData.collection(name);
    if (!data) {
      console.error(`Collection "${name}" not found`);
      process.exit(1);
    }
    const entries = Array.isArray(data) ? data : Object.values(data);
    console.log(`\n${name}: ${entries.length} entries (showing ${limit}):\n`);
    entries.slice(0, limit).forEach((e, i) => {
      console.log(`[${i}] ${JSON.stringify(e).substring(0, 300)}`);
    });
    break;
  }

  // ── Find by ID ────────────────────────────────────────────
  case 'find': {
    const colName = args[0];
    const id = args[1];
    if (!colName || !id) {
      console.error('Usage: node tools/data-explorer.js find <collection> <id>');
      process.exit(1);
    }
    const entry = gameData.find(colName, id);
    if (!entry) {
      console.log(`\nNot found: ${colName}#${id}`);
    } else {
      console.log(`\n${colName}#${id}:`);
      console.log(JSON.stringify(entry, null, 2));
    }
    break;
  }

  // ── Full-text search ──────────────────────────────────────
  case 'search':
  case 'grep': {
    const name = args[0];
    const term = args.slice(1).join(' ').toLowerCase();
    const data = gameData.collection(name);
    if (!data) {
      console.error(`Collection "${name}" not found`);
      process.exit(1);
    }
    const entries = Array.isArray(data) ? data : Object.values(data);
    const results = entries.filter((e) =>
      JSON.stringify(e).toLowerCase().includes(term),
    );
    console.log(`\nFound ${results.length} matches in ${name}:\n`);
    results.slice(0, 20).forEach((e) => {
      const id = e.id || e.ID || e.key || '(no id)';
      const label = typeof id === 'number' ? `#${id}` : id;
      const summary = JSON.stringify(e).substring(0, 200);
      console.log(`  ${label}: ${summary}`);
    });
    if (results.length > 20) {
      console.log(`  ... and ${results.length - 20} more`);
    }
    break;
  }

  // ── Raw query ─────────────────────────────────────────────
  case 'query': {
    const colName = args[0];
    // Accept simple field=value queries: "field=value"
    const filters = args.slice(1).map((a) => {
      const [field, value] = a.split('=');
      return { field, value };
    });
    const data = gameData.list(colName);
    const results = data.filter((e) =>
      filters.every(({ field, value }) => String(e[field]) === value),
    );
    console.log(`\n${results.length} results:\n`);
    results.slice(0, 20).forEach((e) => console.log(JSON.stringify(e, null, 2)));
    break;
  }

  default:
    console.log(`
Usage:
  node tools/data-explorer.js list                  List all collections
  node tools/data-explorer.js stats                 Entry counts per collection
  node tools/data-explorer.js show <name> [N]       First N entries of a collection
  node tools/data-explorer.js find <name> <id>      Find entry by ID
  node tools/data-explorer.js search <name> <text>  Full-text search
  node tools/data-explorer.js query <name> k=v      Filter by field=value
`);
}
