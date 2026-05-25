// utils/db.js — pure JavaScript database using lowdb (no compilation needed)
// Data is stored in data/vault.json as a JSON file

const path = require('path');
const fs   = require('fs');

// Ensure data/ folder exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'vault.json');

// ─── Load database from disk ──────────────────────────────────────────────────
function load() {
  if (!fs.existsSync(DB_PATH)) {
    return { users: [], files: [], access_logs: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { users: [], files: [], access_logs: [] };
  }
}

// ─── Save database to disk ────────────────────────────────────────────────────
function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ─── db object — mimics the better-sqlite3 API used in the routes ─────────────
const db = {

  // ── prepare(sql).get(...args) ── returns one row or undefined
  // ── prepare(sql).all(...args) ── returns array of rows
  // ── prepare(sql).run(...args) ── executes insert/update/delete
  prepare(sql) {
    return {
      get:  (...args) => db._query(sql, args, 'get'),
      all:  (...args) => db._query(sql, args, 'all'),
      run:  (...args) => db._query(sql, args, 'run'),
    };
  },

  // ── Internal query engine ─────────────────────────────────────────────────
  _query(sql, args, mode) {
    const data = load();
    const s    = sql.trim().toUpperCase();

    // ── SELECT ──────────────────────────────────────────────────────────────
    if (s.startsWith('SELECT')) {
      const rows = db._select(sql, args, data);
      if (mode === 'get') return rows[0];
      return rows;
    }

    // ── INSERT ──────────────────────────────────────────────────────────────
    if (s.startsWith('INSERT')) {
      db._insert(sql, args, data);
      save(data);
      return;
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────
    if (s.startsWith('UPDATE')) {
      db._update(sql, args, data);
      save(data);
      return;
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (s.startsWith('DELETE')) {
      db._delete(sql, args, data);
      save(data);
      return;
    }
  },

  // ── Table name from SQL ────────────────────────────────────────────────────
  _table(sql) {
    const m = sql.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+(\w+)/i);
    return m ? m[1] : null;
  },

  // ── Parse WHERE clause into filter function ────────────────────────────────
  // Supports: col = ?, col IS NULL, substr(col,1,10) = ?, col > ?, col < ?
  _parseWhere(sql, args) {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/is);
    if (!whereMatch) return () => true;

    let conditions = whereMatch[1].trim();
    let argIndex   = 0;

    // Split by AND (simple, no OR support needed for our queries)
    const parts = conditions.split(/\s+AND\s+/i);

    return (row) => {
      let ai = argIndex;
      for (const part of parts) {
        const val = args[ai++];

        // IS NULL
        if (/IS NULL/i.test(part)) {
          const col = part.match(/(\w+)\s+IS NULL/i)[1];
          if (row[col] !== null && row[col] !== undefined && row[col] !== '') return false;
          continue;
        }

        // substr(col, 1, 10) = ?  (used for date comparisons)
        const substrMatch = part.match(/substr\((\w+),\s*1,\s*10\)\s*=\s*\?/i);
        if (substrMatch) {
          const col = substrMatch[1];
          if (!row[col] || row[col].substring(0, 10) !== val) return false;
          continue;
        }

        // col > ?
        const gtMatch = part.match(/(\w+)\s*>\s*\?/i);
        if (gtMatch) {
          const col = gtMatch[1];
          if (!(row[col] > val)) return false;
          continue;
        }

        // col < ?
        const ltMatch = part.match(/(\w+)\s*<\s*\?/i);
        if (ltMatch) {
          const col = ltMatch[1];
          if (!(row[col] < val)) return false;
          continue;
        }

        // col = ?  (normal equality)
        const eqMatch = part.match(/(\w+)\s*=\s*\?/i);
        if (eqMatch) {
          const col = eqMatch[1];
          // eslint-disable-next-line eqeqeq
          if (row[col] != val) return false;
          continue;
        }
      }
      return true;
    };
  },

  // ── SELECT implementation ──────────────────────────────────────────────────
  _select(sql, args, data) {
    const table    = db._table(sql);
    const rows     = (data[table] || []);
    const filter   = db._parseWhere(sql, args);

    let result = rows.filter(filter);

    // COUNT(*)
    if (/SELECT\s+COUNT\(\*\)\s+as\s+n/i.test(sql)) {
      return [{ n: result.length }];
    }

    // SUM(col)
    const sumMatch = sql.match(/SELECT\s+SUM\((\w+)\)\s+as\s+n/i);
    if (sumMatch) {
      const col = sumMatch[1];
      const total = result.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);
      return [{ n: total }];
    }

    // GROUP BY device_type / reason
    if (/GROUP BY (\w+)/i.test(sql)) {
      const groupCol = sql.match(/GROUP BY (\w+)/i)[1];
      const counts   = {};
      result.forEach(r => {
        const k = r[groupCol] || 'other';
        counts[k] = (counts[k] || 0) + 1;
      });
      return Object.entries(counts).map(([k, v]) => ({ [groupCol]: k, cnt: v }));
    }

    // ORDER BY
    if (/ORDER BY (\w+) DESC/i.test(sql)) {
      const col = sql.match(/ORDER BY (\w+) DESC/i)[1];
      result = result.sort((a, b) => (b[col] || '') > (a[col] || '') ? 1 : -1);
    } else if (/ORDER BY (\w+)/i.test(sql)) {
      const col = sql.match(/ORDER BY (\w+)/i)[1];
      result = result.sort((a, b) => (a[col] || '') > (b[col] || '') ? 1 : -1);
    }

    // LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+|\?)/i);
    if (limitMatch) {
      const limitVal = limitMatch[1] === '?' ? args[args.length - 1] : parseInt(limitMatch[1]);
      result = result.slice(0, limitVal);
    }

    return result;
  },

  // ── INSERT implementation ──────────────────────────────────────────────────
  _insert(sql, args, data) {
    const table  = db._table(sql);
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (!colMatch) return;

    const cols = colMatch[1].split(',').map(c => c.trim());
    const row  = {};

    cols.forEach((col, i) => {
      row[col] = args[i] !== undefined ? args[i] : null;
    });

    // Auto-set timestamp fields if not provided
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (table === 'users'       && !row.created_at)  row.created_at  = now;
    if (table === 'files'       && !row.uploaded_at)  row.uploaded_at  = now;
    if (table === 'access_logs' && !row.accessed_at) row.accessed_at = now;

    // Auto-increment id for access_logs
    if (table === 'access_logs') {
      const existing = data[table] || [];
      row.id = existing.length > 0 ? Math.max(...existing.map(r => r.id || 0)) + 1 : 1;
    }

    if (!data[table]) data[table] = [];
    data[table].push(row);
  },

  // ── UPDATE implementation ──────────────────────────────────────────────────
  _update(sql, args, data) {
    const table = db._table(sql);

    // Parse SET clauses: UPDATE files SET col1 = ?, col2 = ? WHERE ...
    const setMatch  = sql.match(/SET\s+(.+?)\s+WHERE/is);
    if (!setMatch) return;

    const setParts  = setMatch[1].split(',').map(s => s.trim());
    const setCols   = setParts.map(p => p.match(/(\w+)\s*=/i)[1]);

    // Args: first N are SET values, last one is the WHERE value
    const setArgs   = args.slice(0, setCols.length);
    const whereArgs = args.slice(setCols.length);

    // Special: download_count = download_count + 1 (no ? arg for this)
    const incrementCols = {};
    setParts.forEach(p => {
      const incMatch = p.match(/(\w+)\s*=\s*\1\s*\+\s*1/i);
      if (incMatch) incrementCols[incMatch[1]] = true;
    });

    // Rebuild SET cols without the increment ones
    const normalSetCols = setCols.filter(c => !incrementCols[c]);
    const normalSetArgs = setArgs.slice(0, normalSetCols.length);
    const actualWhereArgs = args.slice(normalSetCols.length);

    const filter = db._parseWhere(sql, actualWhereArgs);

    (data[table] || []).forEach(row => {
      if (!filter(row)) return;

      // Apply normal SET
      normalSetCols.forEach((col, i) => { row[col] = normalSetArgs[i]; });

      // Apply increments
      Object.keys(incrementCols).forEach(col => {
        row[col] = (Number(row[col]) || 0) + 1;
      });
    });
  },

  // ── DELETE implementation ──────────────────────────────────────────────────
  _delete(sql, args, data) {
    const table  = db._table(sql);
    const filter = db._parseWhere(sql, args);
    data[table]  = (data[table] || []).filter(row => !filter(row));
  },
};

module.exports = db;
