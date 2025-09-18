# WebSocket Implementation Checklist

## Immediate Actions (This Week)

### Framework Enhancements
- [ ] Add `useSocketSubscription` hook for room-based subscriptions
- [ ] Add `useSocketProgress` hook for progress tracking
- [ ] Create `FrameworkEventPatterns` class with:
  - [ ] Job queue pattern (from competitor-ai)
  - [ ] Progress tracking (from cpcodebase)
  - [ ] Room management (from vpp-manager)
- [ ] Enhance StandardServer to support multiple WebSocket servers
- [ ] Add connection state recovery option

### Critical Fixes
- [ ] **epi-cpcodebase**: Remove duplicate SocketContext
- [ ] **epi-competitor-ai**: Replace 245-line WebSocketService with framework patterns
- [ ] **epi-node-programmer**: Add connection status UI components

### Preserve Innovations
- [ ] **epi-vpp-manager**: Keep energy dispatch & NESO integration
- [ ] **epi-competitor-ai**: Keep dual WebSocket for browser extension
- [ ] **epi-node-programmer**: Keep manufacturing bridge pattern

## Testing Requirements

### Connection Tests
- [ ] Single WebSocket connection per app (verify with `lsof -i :PORT`)
- [ ] No browser console WebSocket errors
- [ ] Health endpoint reports WebSocket as "healthy"
- [ ] Connection status UI shows correct state

### Feature Tests
- [ ] Job progress tracking works (competitor-ai)
- [ ] Energy dispatch works (vpp-manager)
- [ ] Manufacturing events work (node-programmer)
- [ ] File scanning progress works (cpcodebase)

## Migration Priority

### Week 1: Framework & Critical Fixes
1. Add framework utilities
2. Fix epi-cpcodebase duplication
3. Test and validate

### Week 2: Major Migrations
1. Migrate competitor-ai WebSocketService
2. Add connection UI to node-programmer
3. Create migration guide

### Week 3: Polish & Documentation
1. Update all apps to latest patterns
2. Complete documentation
3. Performance testing

## Validation Checklist

### Per App
- [ ] Only uses framework's useSocketIO hook
- [ ] Shows connection status consistently
- [ ] No duplicate WebSocket connections
- [ ] Domain logic separated from infrastructure
- [ ] Proper error handling

### Framework
- [ ] Common patterns extracted
- [ ] Backwards compatibility maintained
- [ ] Documentation complete
- [ ] Type definitions exported
- [ ] Tests written

## Success Criteria
- ✅ 500+ lines of duplicate code removed
- ✅ All apps use consistent connection status
- ✅ Framework provides reusable patterns
- ✅ Special requirements preserved (dual WebSocket, energy dispatch, etc.)
- ✅ Migration path clear and tested