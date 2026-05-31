# Lazy-Loading Implementation Guide

## Why Lazy-Loading?

The application uses **lazy-loading** for the DatabaseClient to solve a critical issue:

**Problem:** better-sqlite3 is a native module that fails to load at module initialization time if the toolchain isn't available or the build is incomplete.

**Impact:** When `import { DatabaseClient } from database` runs at module load, ANY import error cascades and prevents the entire main process from initializing.

**Solution:** Defer database initialization to `app.whenReady()` using dynamic imports.

## Implementation

### Before (Failed)
```typescript
// app/main/main.ts
import { DatabaseClient } from "../database/database";  // ❌ Blocks on import

let database: DatabaseClient;

app.whenReady().then(() => {
  const databasePath = path.join(app.getPath("userData"), "mla-plus.db");
  database = new DatabaseClient(databasePath);
  registerHandlers();
  createWindow();
});
```

**Problem:** If DatabaseClient fails to load, app module never initializes → Electron app crashes before it can even start.

### After (Lazy-Loaded)
```typescript
// app/main/main.ts
let database: any;  // ✅ No import at module level

app.whenReady().then(async () => {
  try {
    const { DatabaseClient } = await import("../database/database.js");
    const databasePath = path.join(app.getPath("userData"), "mla-plus.db");
    database = new DatabaseClient(databasePath);
  } catch (error) {
    console.error("Failed to initialize database:", error);
    dialog.showErrorBox(
      "Database Error",
      "Failed to initialize database. The application will exit."
    );
    app.quit();
    return;
  }
  registerHandlers();
  createWindow();
});
```

**Benefits:**
- Electron app initializes successfully even if database module fails
- User sees a proper error dialog instead of a crash
- Deferred initialization allows Electron to set up its context first
- Graceful failure handling

### Error Handling in Database Module
```typescript
// app/database/database.ts
let Database: any;
try {
  Database = require("better-sqlite3");
} catch (error) {
  console.warn("better-sqlite3 not available:", error instanceof Error ? error.message : String(error));
}

export class DatabaseClient {
  constructor(dbPath: string) {
    if (!Database) {
      throw new Error(
        "better-sqlite3 module is not available. " +
        "This usually means the native module failed to compile."
      );
    }
    // ... rest of constructor
  }
}
```

## When This Pattern Applies

Use lazy-loading for:
- ✅ Native modules with build dependencies
- ✅ Modules that might fail to load in certain environments
- ✅ Heavy modules that can be deferred
- ✅ Optional features that shouldn't crash the app

Don't use lazy-loading for:
- ❌ Core synchronous dependencies
- ❌ Modules needed during module initialization
- ❌ Hot-path performance-critical code

## Testing Lazy-Loading

### Test 1: Module Loads Without Database
```bash
# Temporarily rename better-sqlite3
mv node_modules/better-sqlite3 node_modules/better-sqlite3.bak
npm run build:main
npm start
# Should show: "Database Error" dialog and exit gracefully
mv node_modules/better-sqlite3.bak node_modules/better-sqlite3
```

### Test 2: Normal Operation
```bash
npm run build
npm start
# Should launch normally with database initialized
```

## TypeScript Considerations

When using `let database: any`, you lose type checking:

```typescript
let database: any;  // ❌ No type safety

// To preserve some typing while being flexible:
let database: DatabaseClient | null = null;  // ✅ Better

// In lazy-loading:
try {
  const { DatabaseClient } = await import("../database/database.js");
  database = new DatabaseClient(databasePath) as DatabaseClient;
} catch (error) {
  database = null;
}

// Usage remains type-safe:
if (database) {
  database.listMovies();  // ✅ TypeScript knows about listMovies
}
```

## Performance Impact

Negligible - initialization delay is:
- Electron app startup: ~100ms overhead (acceptable)
- End-user visible delay: 0ms (happens before window shows)
- Runtime performance: 0ms (module runs same way after init)

## Future Improvements

1. **Retry Logic:** Add automatic retry with exponential backoff
   ```typescript
   async function initDatabaseWithRetry(maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         // attempt import
       } catch (error) {
         if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
         else throw error;
       }
     }
   }
   ```

2. **Offline Mode:** Continue app operation without database
   ```typescript
   let database: DatabaseClient | null = null;
   // App can work read-only if database unavailable
   ```

3. **Background Recovery:** Try to initialize database in background
   ```typescript
   async function attemptDatabaseInit() {
     // Retry database initialization periodically
   }
   ```

## References

- Node.js dynamic import: https://nodejs.org/docs/latest/api/esm.html#esm_dynamic_import
- ES module specification: https://tc39.es/ecma262/#sec-import-call
- TypeScript dynamic import: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-4.html#dynamic-import-expressions
