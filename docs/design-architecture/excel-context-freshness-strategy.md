# Excel Context Freshness Strategy for Excella

**Research Date:** November 12, 2025  
**Status:** Production-Ready Architecture

---

## Executive Summary

Context freshness in Excel add-ins is **not a real-time problem**. Production Excel add-ins (including Microsoft's own samples) use a **dirty flag + event-driven invalidation** pattern, not continuous synchronization.

The goal is not to keep context perfectly fresh—it's to acknowledge that context **will get stale** and provide intelligent refresh mechanisms.

---

## What Office.js Can Actually Do

### Change Detection Events
Office.js provides real-time event listeners:
- `onChanged` - Fires when cell data changes
- `onSelectionChanged` - Fires when selection changes
- `onActivated` - Fires when worksheet activates
- `bindingDataChanged` - Fires for specific range changes (more efficient)

### The Limitation: These Events Don't Tell You Everything

You can listen to `onChanged`, but:
- **Excel for Web is broken** - `onChange` doesn't fire for data validation changes (known issue since Oct 2023)
- **No cross-sheet detection** - If user edits Sheet2, you won't know unless you're listening to Sheet2
- **No worksheet-level events** - Can't get "entire worksheet changed" event, only specific ranges
- **Events can queue** - Rapid user clicks cause events to fire late, not real-time

---

## Performance Reality: Why Not Continuous Sync?

Each `context.sync()` is expensive:
- **50-200ms latency** per round-trip to Excel
- **Cannot call in loops** - Microsoft explicitly warns against this
- **Blocks UI rendering** - Constant syncing freezes the taskpane
- **Network-dependent** - Worse on slower connections

**Continuous context capture = unacceptable performance.**

---

## Production Pattern: Dirty Flag Strategy

This is what **Microsoft's own sample code** does:

```typescript
// Listen for changes
table.onChanged.add(onTableChanged);

function onTableChanged() {
  // DON'T re-capture context yet
  // Just mark it as dirty
  isTableDirty = true;
  
  // Enable refresh button in UI
  enableRefreshButton();
}

// When user clicks refresh (or TTL expires):
async function refreshContext() {
  const newContext = await captureFullContext();
  // Now update your context
  isTableDirty = false;
  disableRefreshButton();
}
```

**Benefits:**
- ✅ No continuous syncing overhead
- ✅ User has control when to refresh
- ✅ Clear in UI when data is stale
- ✅ Works reliably across platforms

---

## Three-Tier Context Strategy

### Layer 1: Selection Context (Always Fresh)
- **What**: What cells user selected right now
- **How**: Capture on every selection change (debounced 300-500ms)
- **Pattern**: Always sync before agent executes

### Layer 2: Table Structure (Semi-Fresh)
- **What**: Table names, headers, data types, ranges
- **How**: Cache for session, invalidate on detected changes
- **Events to listen**: Table added, table deleted, columns added/deleted
- **Pattern**: Listen to events, set dirty flag, user manually refreshes or TTL expires (5 min)

### Layer 3: Deep Analysis (Mostly Stale)
- **What**: Formula dependencies, cross-sheet references, full workbook schema
- **How**: Cache aggressively, invalidate only on structure change
- **Pattern**: Use for entire session unless explicit refresh or TTL (15-30 min)

---

## Event-Driven Invalidation

Don't use TTL alone. Listen for **structural changes** and invalidate selectively:

```typescript
// Listen for structure changes
worksheet.onNameChanged.add(() => {
  // Only invalidate Layer 3 (deep analysis)
  cache.layer3.invalidate();
});

table.onAdded.add(() => {
  // Invalidate Layer 2 and 3
  cache.layer2.invalidate();
  cache.layer3.invalidate();
});

range.onSelectionChanged.add(() => {
  // Always refresh Layer 1
  captureSelectionContext();
});
```

---

## Implementation for Excella

### On Taskpane Open
1. Capture Layer 1 (selection) - instant
2. Fire Trigger.dev job: Capture Layers 2 & 3 in background
3. Cache all three layers

### During Conversation
1. Before agent executes: Recapture Layer 1 (selection)
2. Use cached Layer 2 & 3
3. If user asks for deep analysis: Invalidate Layer 3 and re-capture

### Event Listeners (Always Active)
```typescript
// Lightweight listeners
selection.onChanged.add(() => captureLayer1());
worksheet.onNameChanged.add(() => invalidateLayer3());
table.onAdded.add(() => invalidateLayers2And3());

// Show "Refresh Available" button if dirty
if (isDirty) showRefreshButton();
```

### User-Triggered Refresh
- Explicit "Refresh Data" button in taskpane
- Re-triggers Trigger.dev job
- Updates all three layers

### Automatic Refresh (Optional)
- Auto-refresh Layer 1: On selection change (always)
- Auto-refresh Layer 2: TTL 5 minutes OR event-triggered
- Auto-refresh Layer 3: TTL 15-30 minutes (rarely needed)

---

## What to Tell Agents

Instead of: *"Here's perfectly fresh context for entire workbook"*

Better: *"Here's Layer 1 (current selection). Layer 2 (table structure) was captured 2 min ago. If you need deep analysis, ask user to refresh."*

This is honest and aligns with technical reality.

---

## Common Mistakes to Avoid

❌ **Continuous context.sync() calls** - Kills performance  
❌ **Trying to stay perfectly in sync** - Impossible with Office.js  
❌ **Only using TTL, ignoring events** - Miss important invalidation opportunities  
❌ **Capturing Layer 3 automatically** - Wastes compute, rarely needed  
❌ **Re-capturing everything on every change** - Defeats purpose of caching  

---

## References

**Microsoft Official Documentation:**
- [Work with Events using the Excel JavaScript API](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-events)
- [Excel Add-in Performance Best Practices](https://learn.microsoft.com/en-us/office/dev/add-ins/excel/performance)
- [Persisting Add-in State and Settings](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/persisting-add-in-state-and-settings)

**Production Sample Code (Dirty Flag Pattern):**
- [Office Add-in Samples: Contextual Tabs](https://github.com/OfficeDev/Office-Add-in-samples/blob/main/Samples/office-contextual-tabs/README.md)
  - Shows exact pattern: `onChanged` event → set `isTableDirty = true` → enable refresh button
  - Real production code used by Microsoft

**Known Issues:**
- [GitHub Issue #3888: onChange Event Not Triggering in Excel Web](https://github.com/OfficeDev/office-js/issues/3888)
  - Data validation dropdown changes don't trigger onChange in Excel Web (broken since Oct 2023)

---

## Next Steps for Excella

1. Implement Layer 1/2/3 cache structure
2. Add event listeners for Layer 2/3 invalidation
3. Design "Refresh Available" UI indicator
4. Add optional explicit refresh button
5. Document context freshness limitations in user docs

**This approach is proven, performant, and aligns with how Microsoft builds Excel add-ins.**

---

**End of Context Freshness Strategy**
