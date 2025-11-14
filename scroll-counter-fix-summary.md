# Scroll Counter Fix Summary

## Problem
Navigation counter updated correctly when using buttons, but **NOT** when scrolling with mouse or browser scrollbar.

## Root Cause
**Index Mismatch**: The `getCurrentVisibleMessageIndex()` method was internally calling `findMessages()` which could return a different messages array than the one stored in `NavigationModule.messages`.

### The Issue Flow
1. NavigationModule stores 10 messages in `this.messages`
2. User scrolls with mouse
3. Scroll handler calls `getCurrentVisibleMessageIndex()`
4. That method internally calls `findMessages()` which might find 12 messages
5. Returns index based on 12 messages (e.g., index 5)
6. Counter shows "6/10" using NavigationModule's 10 messages
7. **Result**: Inconsistent index calculations

## Solution Implemented

### 1. Updated DOMUtils-Core.js
**File**: `/src/utils/DOMUtils-Core.js` (line 175)

```javascript
// BEFORE
getCurrentVisibleMessageIndex() {
  const messages = this.findMessages(); // ❌ Always recalculates
  // ... rest of logic
}

// AFTER
getCurrentVisibleMessageIndex(messages = null) {
  const msgArray = messages || this.findMessages(); // ✅ Uses provided array
  // ... rest of logic using msgArray
}
```

### 2. Updated NavigationModule.js
**File**: `/src/modules/NavigationModule.js`

Updated all 5 calls to pass the messages array:

```javascript
// Line 396 - navigatePrevious()
this.currentIndex = this.dom.getCurrentVisibleMessageIndex(this.messages);

// Line 411 - navigateNext()
this.currentIndex = this.dom.getCurrentVisibleMessageIndex(this.messages);

// Line 465 - updateCounter()
this.currentIndex = this.dom.getCurrentVisibleMessageIndex(this.messages);

// Line 500 - updateButtonStates()
const currentIdx = ... : this.dom.getCurrentVisibleMessageIndex(this.messages);

// Line 573 - setupScrollListener()
const newIndex = this.dom.getCurrentVisibleMessageIndex(this.messages);
```

## How It Works Now

1. **Consistent Messages Array**: All index calculations use the same `this.messages` array
2. **Scroll Event Flow**:
   - User scrolls with mouse/scrollbar
   - Scroll listener fires (throttled 300ms)
   - Calls `getCurrentVisibleMessageIndex(this.messages)`
   - Uses NavigationModule's messages array for calculation
   - Updates `currentIndex` if changed
   - Counter updates immediately with correct value

## Testing

Run `test-scroll-counter.js` in browser console:

```javascript
// Tests automatic scrolling to different positions
// Shows counter updates for each position
// Monitors manual scroll for 5 seconds
```

## Verification Checklist

✅ **Mouse Scroll**
- Scroll with mouse wheel → Counter updates within 300ms

✅ **Scrollbar**
- Drag browser scrollbar → Counter updates within 300ms

✅ **Keyboard Scroll**
- Page Up/Down keys → Counter updates within 300ms

✅ **Touch/Trackpad**
- Touch scroll or trackpad → Counter updates within 300ms

✅ **Button Navigation**
- Previous/Next/Top buttons → Counter updates immediately

✅ **Panel Navigation**
- Click bookmark/marker/edit → Counter updates to correct position

## Result

The navigation counter now:
- **Always uses the same messages array** for index calculations
- **Updates consistently** regardless of how scrolling occurs
- **Shows accurate position** (X/Y format) at all times
- **No more mismatches** between actual position and displayed counter

## Performance Impact

Minimal - the fix actually improves performance slightly:
- Avoids redundant `findMessages()` calls when messages array is already available
- Uses cached messages array for all calculations
- No additional DOM queries needed