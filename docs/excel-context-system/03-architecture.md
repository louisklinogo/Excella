# Excel Context Architecture

**Implementation Date:** November 13, 2025  
**Status:** Production-Ready

---

## Overview

This document describes the Excel Context Freshness architecture for Excella, implementing a three-tier caching system with event-driven invalidation and SOLID design principles.

---

## Architecture Principles

### SOLID Design

1. **Single Responsibility**: Each class has one job
   - `OfficeJsClient`: Office.js interaction only
   - `ContextCache`: Cache storage only
   - `ExcelEventManager`: Event listening only
   - `ExcelContextService`: Orchestration only

2. **Open/Closed**: Extensible without modification
   - New cache strategies via `ICacheStrategy`
   - New context layers via extending interfaces
   - Pluggable conflict detection

3. **Liskov Substitution**: Interfaces enable testing
   - Mock `IExcelClient` for unit tests
   - Swap cache implementations
   - Test with different strategies

4. **Interface Segregation**: Focused interfaces
   - `IContextCache` for cache operations
   - `ICacheStrategy` for refresh logic
   - `IConflictDetector` for validation

5. **Dependency Inversion**: Depend on abstractions
   - Service depends on `IExcelClient`, not concrete Office.js
   - Strategy pattern for TTL logic
   - Event system is pluggable

---

## Three-Tier Context Strategy

### Layer 1: Selection Context (Always Fresh)
- **What**: Current user selection (cells, values, formulas)
- **Refresh**: On every selection change (debounced 500ms)
- **TTL**: 0 (always refresh)
- **Use Case**: Agent needs to know what user is working on

### Layer 2: Table Structure (Semi-Fresh)
- **What**: Table names, headers, data types, worksheets
- **Refresh**: Event-driven invalidation + TTL-based
- **TTL**: 2-15 minutes (adaptive based on user activity)
- **Use Case**: Agent needs table schema to generate queries

### Layer 3: Deep Analysis (Mostly Stale)
- **What**: Formula dependencies, cross-sheet references
- **Refresh**: On-demand only (expensive operation)
- **TTL**: 30 minutes (manual refresh recommended)
- **Use Case**: Complex analysis requiring formula graph

---

## Event-Driven Invalidation

The system listens for Excel events to invalidate cache intelligently:

```typescript
// Events that invalidate Layer 2
- onTableChanged: Table data modified
- onWorksheetAdded: New worksheet created
- onWorksheetDeleted: Worksheet removed

// Events that trigger Layer 1 capture
- onSelectionChanged: User selected different cells
```

**Benefits**:
- ✅ Catches structural changes immediately
- ✅ Avoids unnecessary refreshes
- ✅ Provides clear UI feedback when data is stale

---

## Adaptive TTL Strategy

TTL values adjust based on user activity:

```typescript
Layer 2 TTL:
- Aggressive (2 min): >10 edits in last minute
- Default (5 min): Normal activity
- Passive (15 min): No edits in last minute
```

This ensures:
- Active editors get fresher data
- Idle users don't waste API calls
- System adapts to usage patterns

---

## Conflict Detection

Before writing to Excel, the system checks if cells have changed:

```typescript
1. Capture selection context (includes hash of values)
2. User performs operations
3. Before write: Compare current hash with cached hash
4. If different: Throw StaleContextError
5. If same: Proceed with write
```

**Prevents**:
- Overwriting user edits
- Race conditions
- Data loss

---

## File Structure

```
lib/excel/
├── types.ts                     # Domain types and interfaces
├── cache/
│   ├── types.ts                 # Cache interfaces
│   ├── context-cache.ts         # Cache implementation
│   ├── strategy.ts              # Adaptive TTL strategy
│   └── conflict-detector.ts     # Hash-based conflict detection
├── office/
│   ├── types.ts                 # Office.js interfaces
│   └── client.ts                # Office.js wrapper
├── events/
│   └── manager.ts               # Event listener manager
├── services/
│   └── context-service.ts       # Main facade
├── telemetry.ts                 # Analytics and tracking
└── index.ts                     # Public API

mastra/tools/
└── excel-context-tool.ts        # Mastra integration

hooks/
└── use-excel-context.ts         # React hook

components/excel/
├── context-indicator.tsx        # UI status indicator
└── debug-panel.tsx              # Developer tools
```

---

## Usage Examples

### From Mastra Agent

```typescript
import { excelContextTool } from "@/mastra/tools/excel-context-tool";

// Add to agent tools
export const excelAgent = new Agent({
  tools: {
    excelContextTool,
    // ... other tools
  }
});
```

### From React Component

```typescript
import { useExcelContext } from "@/hooks/use-excel-context";

function MyComponent() {
  const { context, metadata, refresh } = useExcelContext();

  // Access context
  const tables = context?.structure?.tables ?? [];

  // Manual refresh
  const handleRefresh = () => {
    refresh(["structure"]);
  };

  return (
    <div>
      <p>Tables: {tables.length}</p>
      <button onClick={handleRefresh}>Refresh</button>
    </div>
  );
}
```

### Programmatic Usage

```typescript
import { createExcelContextService } from "@/lib/excel";

const service = createExcelContextService({
  enableTelemetry: true,
  enableAutoRefresh: false,
});

await service.initialize();

// Get context with smart refresh
const context = await service.getContextForAgent();

// Safe write with conflict detection
await service.safeWrite("A1:B10", values);
```

---

## Telemetry

The system tracks:
- Sync latency (every `context.sync()` call)
- Event reliability (which events fire)
- Cache hit/miss rates
- Context capture duration
- Invalidation reasons
- TTL decisions

**Access telemetry**:
```typescript
const telemetry = service.getTelemetry();
console.log(telemetry.syncLatency); // Array of latencies
```

---

## Best Practices

### 1. Always Capture Layer 1 Before Operations
```typescript
await service.captureLayer1();
const selection = service.cache.getLayer1();
// Now use selection
```

### 2. Use Event Listeners for Real-Time Updates
```typescript
// Events are registered automatically
// Just check metadata for staleness
if (metadata.layer2.status === "stale") {
  await service.captureLayer2();
}
```

### 3. Only Capture Layer 3 When Needed
```typescript
// Layer 3 is expensive - use sparingly
if (needFormulaAnalysis) {
  await service.captureLayer3();
}
```

### 4. Show Staleness in UI
```typescript
<ContextFreshnessIndicator />
// Displays status and age of each layer
```

### 5. Handle Conflicts Gracefully
```typescript
try {
  await service.safeWrite(range, values);
} catch (error) {
  if (error instanceof StaleContextError) {
    // Refresh and retry
    await service.captureLayer1();
    await service.safeWrite(range, values);
  }
}
```

---

## Testing Strategy

### Unit Tests
- Mock `IExcelClient` for isolated cache testing
- Test TTL calculation logic
- Test conflict detection algorithms

### Integration Tests
- Use real Office.js in test environment
- Verify event listeners fire correctly
- Test full capture-cache-invalidate cycle

### E2E Tests
- Test with real Excel workbooks
- Verify cross-platform behavior (Windows/Mac/Web)
- Test performance under load

---

## Performance Considerations

### Sync Latency
- **Average**: 50-200ms per `context.sync()`
- **Mitigation**: Cache aggressively, debounce events
- **Monitoring**: Track via telemetry

### Memory Usage
- **Layer 1**: ~1-10 KB (single range)
- **Layer 2**: ~10-100 KB (tables + worksheets)
- **Layer 3**: ~100 KB - 1 MB (formula graph)
- **Total**: < 2 MB for typical workbooks

### Event Overhead
- **Selection changes**: High frequency, debounced
- **Table changes**: Medium frequency, throttled
- **Structure changes**: Low frequency, immediate

---

## Future Enhancements

1. **Progressive Context Capture**: Capture visible sheets first
2. **Context Diffing**: Track what changed, not just "stale"
3. **Persistent Cache**: Store context in IndexedDB
4. **Cross-Component Sync**: Share context across add-in parts
5. **Smart Prefetch**: Predict needed context based on usage

---

## Troubleshooting

### Events Not Firing
**Problem**: Context not invalidating when data changes  
**Solution**: Check if event listeners are registered
```typescript
const stats = service.getDebugStatus().events;
console.log(stats); // Should show active listeners
```

### High Sync Latency
**Problem**: Slow `context.sync()` calls  
**Solution**: Check network (Excel Web) or reduce data volume
```typescript
const telemetry = service.getTelemetry();
const avgLatency = telemetry.syncLatency.reduce((a, b) => a + b) / telemetry.syncLatency.length;
console.log(`Avg sync: ${avgLatency}ms`);
```

### Stale Context Errors
**Problem**: Frequent `StaleContextError` on writes  
**Solution**: Capture Layer 1 immediately before write
```typescript
await service.captureLayer1(); // Force fresh capture
await service.safeWrite(range, values);
```

---

## References

- [Excel Context Freshness Strategy](./design-architecture/excel-context-freshness-strategy.md)
- [Office.js API Documentation](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-events)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

**End of Architecture Documentation**
