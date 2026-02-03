# Manual Test Checklist for Voice Call & Docker Performance

**Feature**: 001-voice-docker-perf  
**Quick Tests**: 15-20 minutes  
**Extended Test**: 4 hours background

---

## Quick Manual Tests (15-20 minutes total)

### Test 1: HMR Performance Test (2 minutes) ⚡
**Task Reference**: T026, T027  
**Requirement**: SC-004 - HMR < 3 seconds for 95% of changes

**Steps**:
1. Open http://localhost:3000 in browser
2. Open apps/web/app/layout.tsx in editor
3. Change any text string (e.g., page title)
4. Save file and start stopwatch
5. Stop when browser updates

**Checklist**:
- [ ] Browser updated without full refresh (HMR only)
- [ ] Time recorded: _____ seconds
- [ ] Result: ✅ PASS (< 3s) / ❌ FAIL (≥ 3s)

---

### Test 2: Voice Call Connection Time (3 minutes) 📞
**Task Reference**: T008-T015  
**Requirement**: SC-001 - Calls connect in < 5 seconds

**Steps**:
1. Open two browser windows/tabs
2. Log in as two different users
3. Both users join the same workspace office
4. User A: Click call button on User B's avatar
5. User B: Accept the call
6. Measure time from "call initiated" to "Peer connected" in console

**Checklist**:
- [ ] Call invitation received by User B
- [ ] Call accepted successfully
- [ ] Audio connected (users can hear each other)
- [ ] Connection time: _____ seconds
- [ ] Console shows: `[VoiceCall] ✅ Peer connected`
- [ ] Result: ✅ PASS (< 5s) / ❌ FAIL (≥ 5s)

---

### Test 3: Call Quality Indicator UI (2 minutes) 📊
**Task Reference**: T013  
**Requirement**: Real-time quality monitoring visible to users

**Steps**:
1. Establish voice call between two users (from Test 2)
2. Look for quality indicator in the call UI
3. Open browser console (F12)
4. Observe quality stats logs

**Checklist**:
- [ ] Quality indicator visible in UI
- [ ] Signal bars displayed (1-4 bars)
- [ ] Color coding: green/yellow/red based on quality
- [ ] Hover tooltip shows detailed metrics (packet loss, jitter, RTT)
- [ ] Console logs quality stats every ~5 seconds
- [ ] Result: ✅ PASS / ❌ FAIL

---

### Test 4: Memory Leak Detection (5 minutes) 🧹
**Task Reference**: T016-T025  
**Requirement**: SC-003 - Memory within 20% of baseline after 10 calls

**Steps**:
1. Open Chrome DevTools → Memory tab
2. Click "Take snapshot" (Baseline)
3. Make a voice call, talk for 10 seconds, end call properly
4. Wait 5 seconds after call ends
5. Repeat step 3-4 for **3 total calls** (quick test) or **10 calls** (full test)
6. Click "Take snapshot" again (After calls)
7. Compare heap sizes

**Checklist**:
- [ ] Baseline snapshot taken: _____ MB
- [ ] Number of calls completed: _____ (3 or 10)
- [ ] After-calls snapshot taken: _____ MB
- [ ] Memory difference: _____ MB (_____ %)
- [ ] Search for "HTMLAudioElement" in snapshot: _____ found (should be 0)
- [ ] Search for "SimplePeer" in snapshot: _____ found (should be 0)
- [ ] Result: ✅ PASS (< 20% increase) / ❌ FAIL (≥ 20% increase)

---

### Test 5: Page Visibility - Graceful Degradation (3 minutes) 👁️
**Task Reference**: T011-T012  
**Requirement**: Stats polling adjusts when tab is backgrounded

**Steps**:
1. Establish voice call between two users
2. In User A's browser, open console (F12)
3. Filter console logs for "VoiceCall"
4. Observe stats being logged every ~5 seconds
5. Switch to a different tab (background the call tab)
6. Wait 15 seconds
7. Switch back to call tab
8. Check console logs

**Checklist**:
- [ ] Stats logged every ~5s when tab is active (visible)
- [ ] Console shows: `📴 Tab backgrounded - reducing stats polling`
- [ ] Stats polling interval increases to ~15s when backgrounded
- [ ] Console shows: `📱 Tab visible - resuming normal stats polling`
- [ ] Stats return to ~5s interval when tab is active again
- [ ] Result: ✅ PASS / ❌ FAIL

---

## Extended Test (4 hours background)

### Test 6: No Auto-Refresh Stability (4 hours) ⏱️
**Task Reference**: T031  
**Requirement**: No unexpected page refreshes during development session

**Steps**:
1. Start Docker environment: `docker compose up -d`
2. Open browser to http://localhost:3000
3. Log in and navigate to office
4. Note start time: _____
5. Leave browser tab open for 4 hours
6. Check periodically for unexpected refreshes
7. At end, verify HMR still works (edit a file)

**Checklist**:
- [ ] Start time: _____
- [ ] End time: _____ (4 hours later)
- [ ] Unexpected page refreshes observed: _____ (count, should be 0)
- [ ] Application still responsive at end: ✅ YES / ❌ NO
- [ ] HMR test at end (edit file): ✅ WORKS / ❌ BROKEN
- [ ] Result: ✅ PASS (0 refreshes) / ❌ FAIL (> 0 refreshes)

---

## Quick Reference: Success Criteria

| Test | Metric | Target | Pass/Fail |
|------|--------|--------|-----------|
| HMR Performance | Response time | < 3 seconds | ___ |
| Call Connection | Connection time | < 5 seconds | ___ |
| Quality Indicator | UI visible | Signal bars + stats | ___ |
| Memory Leak | Memory increase | < 20% baseline | ___ |
| Page Visibility | Stats interval | 5s → 15s → 5s | ___ |
| Auto-Refresh | Unexpected refreshes | 0 in 4 hours | ___ |

---

## Test Execution Log

**Date**: ___________  
**Tester**: ___________  
**Environment**: Docker Development  
**Browser**: Chrome/Firefox/Safari (version: _____ )  
**Docker Version**: ___________

### Overall Results:
- [ ] All quick tests passed (Tests 1-5)
- [ ] Extended test passed (Test 6)
- [ ] Issues found: _____
- [ ] Action items: _____

### Notes:
```
[Space for additional observations, issues, or recommendations]
```

---

## Common Issues & Troubleshooting

### Issue: HMR is slow (> 3 seconds)
**Check**:
- Verify WATCHPACK_POLLING=true in docker logs
- Check CPU usage: `docker stats`
- Verify watchOptions in next.config.ts

### Issue: Voice call doesn't connect
**Check**:
- Both users in same workspace?
- Microphone permissions granted?
- Check browser console for errors
- Check gateway logs: `docker compose logs api-gateway`

### Issue: No quality indicator in UI
**Check**:
- Call actually connected?
- Check browser console for quality stats logs
- Verify VoiceCallUI.tsx rendering QualityIndicator

### Issue: Memory keeps growing
**Check**:
- Audio elements properly cleaned up?
- SimplePeer instances destroyed?
- Use Chrome DevTools Memory profiler to identify leaks

---

## Additional Verification Commands

```bash
# Check Docker service status
docker compose ps

# Check environment variables
docker compose exec web env | grep -E "WATCHPACK|CHOKIDAR"

# Check memory usage
docker stats --no-stream

# Check logs for quality reports
docker compose logs api-gateway | grep "Voice Quality"

# Check for webpack compilation
docker compose logs web | grep -E "compiled|webpack"
```
