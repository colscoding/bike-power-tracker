# Missing Features Roadmap - BPT vs Cadence

Based on the comparison with Cadence app, this document outlines potential features to add to Bike Power Tracker, organized by priority and complexity.

**Last Updated:** January 9, 2026

---

## Priority Levels

- 🔴 **HIGH** - High impact, reasonable effort
- 🟡 **MEDIUM** - Moderate impact or higher effort
- 🟢 **LOW** - Nice-to-have or very high effort
- 🔵 **CONSIDER** - May not align with BPT's focus

---

## Quick Wins (High Impact, Low/Medium Effort)

### 🔴 1. Lap Functionality
**What:** Manual lap creation during workouts with lap-based statistics

**Why:** Essential for interval training and workout structure

**Implementation:**
- Add "Lap" button to UI
- Track lap timestamps in MeasurementsState
- Calculate per-lap statistics (avg power, cadence, HR, duration)
- Display current lap number
- Export laps in TCX/CSV

**Effort:** 🟢 Low (1-2 days)

**Files to modify:**
- `src/state/MeasurementsState.ts` - Add lap tracking
- `src/ui/dashboard.ts` - Add lap button and display
- `src/create-tcx.ts` - Include lap data
- `src/create-csv.ts` - Include lap splits

---

### 🔴 2. Auto-Pause
**What:** Automatically pause recording when speed drops below threshold (e.g., 3 km/h)

**Why:** Prevents data pollution from stopped time at traffic lights

**Implementation:**
- Add setting for auto-pause enable/disable
- Set speed threshold (default 3 km/h)
- Monitor speed from GPS or speed sensor
- Pause recording automatically
- Resume when moving again
- Track moving time vs elapsed time

**Effort:** 🟡 Medium (2-3 days)

**Files to modify:**
- `src/config/settings.ts` - Add autoPause setting
- `src/state/WorkoutState.ts` - Add pause/resume logic
- `src/services/gps/` - Monitor speed
- `src/ui/settings.ts` - Add toggle

---

### 🔴 3. Activity Notes & Metadata
**What:** Add notes, title, and perceived exertion to workouts after completion

**Why:** Context for reviewing workouts later

**Implementation:**
- Add modal after workout stop
- Title field (default: "Cycling - [date]")
- Notes textarea
- Perceived exertion scale (1-10 or RPE scale)
- Save to IndexedDB with workout data
- Display in history
- Include in exports

**Effort:** 🟢 Low (1-2 days)

**Files to modify:**
- `src/ui/modal.ts` - Add post-workout modal
- `src/state/MeasurementsState.ts` - Add metadata fields
- Storage/export modules - Include metadata

---

### 🔴 4. Multiple Data Screens (Swipeable)
**What:** Create 2-3 pre-configured screen layouts that users can swipe between

**Why:** Different workouts need different data focus

**Implementation:**
- Screen 1: Basic (Power, Cadence, HR, Time)
- Screen 2: Extended (add Speed, Distance, Altitude)
- Screen 3: Map-focused (when implemented)
- Swipe gesture or arrow buttons to switch
- Save active screen preference

**Effort:** 🟡 Medium (3-4 days)

**Files to modify:**
- `src/ui/dashboard.ts` - Multi-screen rendering
- Add swipe gesture detection
- `src/config/settings.ts` - Screen preferences
- CSS for screen transitions

---

### 🔴 5. Countdown Timer
**What:** 3, 5, or 10-second countdown before workout starts

**Why:** Time to get positioned/ready before recording

**Implementation:**
- Add setting for countdown duration (0/3/5/10 seconds)
- Show countdown overlay when Start pressed
- Begin recording after countdown
- Optional beep/voice announcement

**Effort:** 🟢 Low (1 day)

**Files to modify:**
- `src/ui/dashboard.ts` - Countdown overlay
- `src/config/settings.ts` - Countdown setting
- `src/state/WorkoutState.ts` - Delay start

---

### 🟡 6. Heart Rate & Power Zones
**What:** Configure zones and display current zone with color coding

**Why:** Essential for structured training

**Implementation:**
- Zone configuration UI (5 zones, % of max or custom watts/bpm)
- Display current zone on dashboard
- Color-code data fields by zone
- Zone time distribution in workout summary
- Zone chart in history

**Effort:** 🟡 Medium (4-5 days)

**Files to modify:**
- `src/config/settings.ts` - Zone configuration
- `src/ui/dashboard.ts` - Zone display and colors
- `src/ui/modal.ts` - Zone summary
- `src/state/MeasurementsState.ts` - Track zone time

---

### 🟡 7. Enhanced Voice Announcements
**What:** Expand voice announcements with customization

**Why:** Hands-free feedback during workouts

**Current:** Basic lap and zone announcements  
**Add:**
- Time-based intervals (every 1/5/10 minutes)
- Distance-based intervals (every 1/5 km)
- Announce specific metrics (speed, power, HR, cadence)
- Announcement speed control
- Enable/disable specific announcements

**Effort:** 🟡 Medium (3-4 days)

**Files to modify:**
- `src/services/voice.ts` - Expand announcement system
- `src/config/settings.ts` - Voice customization
- `src/ui/settings.ts` - Voice settings UI

---

## Medium Priority Features

### 🟡 8. Activity History with Charts
**What:** List of past workouts with detailed charts

**Why:** Review progress and past performances

**Implementation:**
- History view showing all saved workouts
- Workout list with summary (date, duration, avg power, distance)
- Detail view with charts:
  - Power over time
  - HR over time
  - Cadence over time
  - Altitude profile
- Chart zoom and pan
- Delete workouts
- Filter by date range

**Effort:** 🔴 High (5-7 days)

**Files to create/modify:**
- `src/ui/history.ts` - New UI component
- `src/storage/` - Query workout history
- Chart library integration (Chart.js or similar)
- Navigation between dashboard and history

---

### 🟡 9. Strava Integration
**What:** Export to Strava or auto-upload after workouts

**Why:** Most popular platform for cyclists

**Implementation:**
- Option 1 (Simple): Generate Strava-compatible TCX and provide upload link
- Option 2 (Advanced): OAuth integration with auto-upload
- Include all supported data (power, HR, cadence, GPS)
- Activity title, notes, and type mapping

**Effort:** 🟡 Medium (3-5 days depending on OAuth)

**Files to modify:**
- `src/integrations/strava.ts` - New module
- `src/ui/modal.ts` - Add Strava upload option
- Backend may need OAuth flow if auto-upload desired

---

### 🟡 10. GPS Route Visualization
**What:** Display route on map during and after workout

**Why:** See where you rode, track progress

**Implementation:**
- Integrate Leaflet.js or Mapbox GL
- Show current position marker
- Draw route polyline as workout progresses
- Map view toggle on dashboard
- Route replay in history
- Basic offline map tiles

**Effort:** 🔴 High (5-7 days)

**Files to create/modify:**
- Map library integration
- `src/ui/map.ts` - New component
- `src/services/gps/` - Enhanced GPS tracking
- Map provider selection (OpenStreetMap, etc.)

---

### 🟡 11. Elevation Profile & Correction
**What:** Display elevation gain/loss with correction algorithm

**Why:** Altitude data from GPS can be inaccurate

**Implementation:**
- Track elevation from GPS or barometer (if available)
- Calculate gain/loss
- Apply elevation correction using external API (e.g., Open-Elevation)
- Display elevation profile chart
- Show total ascent/descent

**Effort:** 🟡 Medium (3-4 days)

**Files to modify:**
- `src/services/gps/` - Track altitude
- `src/services/elevation.ts` - Correction API
- `src/ui/dashboard.ts` - Display elevation
- Charts for elevation profile

---

### 🟡 12. Workout Cropping/Editing
**What:** Trim start/end of workout if you forgot to stop

**Why:** Clean up accidental recording

**Implementation:**
- Activity detail view with timeline
- Select start/end points to keep
- Crop data points outside selection
- Recalculate statistics
- Confirm before saving

**Effort:** 🟡 Medium (3-4 days)

**Files to modify:**
- `src/ui/history.ts` - Add edit mode
- `src/state/MeasurementsState.ts` - Crop method
- UI for timeline selection

---

### 🟡 13. Calorie Estimation
**What:** Estimate calories burned based on power, HR, weight, duration

**Why:** Common metric users expect

**Implementation:**
- Use power-based formula (most accurate): 1 kJ ≈ 1 kcal
- Fallback to HR-based estimation if no power
- Add user weight setting
- Display during workout and in summary
- Include in exports

**Effort:** 🟢 Low (1-2 days)

**Files to modify:**
- `src/config/settings.ts` - Add weight setting
- `src/calculations/calories.ts` - New module
- `src/ui/dashboard.ts` - Display calories
- `src/ui/modal.ts` - Include in summary

---

### 🟡 14. Week/Month/Year Statistics
**What:** Aggregate statistics across time periods

**Why:** Track progress and trends

**Implementation:**
- Total distance, time, elevation per period
- Average power, HR, cadence
- Activity count
- Charts showing trends
- Compare periods (this week vs last week)

**Effort:** 🟡 Medium (3-4 days)

**Files to create:**
- `src/ui/statistics.ts` - New view
- `src/storage/` - Aggregate queries
- Chart integration for trends

---

## Advanced Features (Longer Term)

### 🟢 15. Structured Workouts
**What:** Follow interval-based workouts with targets

**Why:** Training guidance for specific goals

**Implementation:**
- Workout builder UI (intervals with power/HR targets)
- Workout library (pre-built workouts)
- Import .zwo/.erg/.mrc files
- Real-time guidance (current interval, target, time remaining)
- Visual interval progress bar
- Export workouts for sharing

**Effort:** 🔴 Very High (10-15 days)

**Files to create:**
- `src/workouts/` - New module
- Workout parser for common formats
- Workout execution engine
- UI for workout builder and follower
- Integration with zones and voice announcements

---

### 🟢 16. Training Plans
**What:** Multi-week structured programs

**Why:** Progressive training towards goals

**Implementation:**
- Plan builder with weeks and days
- Library of plans (beginner, FTP, endurance, etc.)
- Calendar view
- Track plan progress
- Adapt workouts based on performance
- TSS/CTL/ATL training load tracking

**Effort:** 🔴 Very High (15-20 days)

**Dependencies:** Requires structured workouts (#15)

---

### 🟢 17. Turn-by-Turn Navigation
**What:** Follow GPX routes with voice navigation

**Why:** Explore new routes without getting lost

**Implementation:**
- GPX import
- Route planning in-app
- Turn-by-turn directions
- Voice announcements for turns
- Off-route detection and rerouting
- Offline map support
- Multiple map styles

**Effort:** 🔴 Very High (15-20 days)

**Files to create:**
- Navigation engine
- Routing API integration (Mapbox, GraphHopper)
- GPX parser
- Turn detection algorithm
- Map UI with directions

**Note:** This is a major undertaking

---

### 🟢 18. Apple Health / Google Fit Integration
**What:** Sync workouts to health platforms

**Why:** Centralized health data

**Implementation:**
- iOS: HealthKit integration via Capacitor
- Android: Google Fit integration
- Automatic sync after workouts
- Permission handling
- Workout type mapping

**Effort:** 🟡 Medium (4-5 days)

**Dependencies:** Requires Capacitor native builds

---

### 🔵 19. Bike Radar Support
**What:** Connect to Garmin Varia and similar radars

**Why:** Safety awareness of approaching vehicles

**Implementation:**
- Bluetooth connection to radar devices
- Display vehicle count and approach speed
- Visual and audio alerts
- Record radar data with workout
- Radar metrics in summary

**Effort:** 🔴 High (5-7 days)

**Consideration:** Niche feature, limited BPT user base with radars

---

### 🔵 20. Strava Live Segments
**What:** Compete against Strava segment efforts in real-time

**Why:** Motivation during rides

**Implementation:**
- Strava OAuth and API integration
- Download nearby segments
- Match GPS position to segments
- Display progress vs PR/KOM
- Segment effort comparison

**Effort:** 🔴 Very High (10-12 days)

**Dependencies:** Requires Strava integration (#9), GPS (#10), and routes

**Consideration:** Complex implementation, may require Strava API approval

---

### 🔵 21. Apple Watch App
**What:** Standalone Watch app for tracking

**Why:** Wrist-based tracking without phone

**Implementation:**
- watchOS app with WatchKit
- Bluetooth sensor support on Watch
- Sync data to iPhone
- Complications for quick start
- Standalone GPS tracking

**Effort:** 🔴 Very High (15-20 days)

**Dependencies:** Requires native iOS development, Apple Watch

**Consideration:** Requires completely different platform expertise

---

### 🔵 22. Multi-Sport Support (Running)
**What:** Track running workouts with pace, cadence

**Why:** Appeal to runners and triathletes

**Implementation:**
- Activity type selection (cycling/running)
- Running-specific metrics (pace, steps, cadence)
- Pedometer integration
- Footpod sensor support
- Running zone calculations

**Effort:** 🔴 High (7-10 days)

**Consideration:** May dilute cycling focus of BPT

---

## Features BPT Should NOT Implement

### ❌ 23. Native Mobile Apps
**Why:** BPT's strength is being web-first. Maintain PWA focus.  
**Alternative:** Capacitor builds for app stores if needed, but web remains primary.

### ❌ 24. Paid Subscription Model
**Why:** Open-source and fully free is BPT's differentiator.  
**Alternative:** Optional paid hosting or premium streaming server support.

### ❌ 25. Complex Social Network
**Why:** Out of scope, would require massive infrastructure.  
**Alternative:** Focus on live streaming and basic kudos/reactions.

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 months)
1. ✅ Lap Functionality (#1)
2. ✅ Activity Notes (#3)
3. ✅ Countdown Timer (#5)
4. ✅ Enhanced Voice Announcements (#7)
5. ✅ Calorie Estimation (#13)

### Phase 2: Core Training Features (2-3 months)
6. ✅ Heart Rate & Power Zones (#6)
7. ✅ Multiple Data Screens (#4)
8. ✅ Auto-Pause (#2)
9. ✅ Activity History with Charts (#8)

### Phase 3: Integration & Analysis (2-3 months)
10. ✅ GPS Route Visualization (#10)
11. ✅ Elevation Profile (#11)
12. ✅ Strava Integration (#9)
13. ✅ Workout Cropping (#12)
14. ✅ Statistics Dashboard (#14)

### Phase 4: Advanced Training (3-4 months)
15. ✅ Structured Workouts (#15)
16. ✅ Training Plans (#16)

### Phase 5: Consider (Future)
17. 🤔 Turn-by-Turn Navigation (#17)
18. 🤔 Health Platform Integration (#18)
19. 🤔 Bike Radar (#19)
20. 🤔 Strava Live Segments (#20)

---

## Alignment with BPT's Vision

### Core Strengths to Maintain
- ✅ Live streaming with viewer interface
- ✅ Web-first, works everywhere
- ✅ Free and open-source
- ✅ Simple, accessible UI
- ✅ Multiple export formats

### Strategic Focus Areas
1. **Double down on streaming**: Make it social (chat, reactions, kudos)
2. **Keep it simple**: Don't over-complicate like Cadence
3. **Web technologies**: Leverage web platform strengths
4. **Quick setup**: No accounts, instant tracking

### What Makes BPT Unique
- **Real-time streaming** architecture (not just live tracking)
- **Stream viewer** with multi-stream support
- **Fully free** with all features
- **Self-hostable** for teams/clubs
- **Web-first** - works on any device

---

## Estimated Total Effort

| Phase | Features | Estimated Days | Priority |
|-------|----------|----------------|----------|
| Phase 1 | 5 features | 8-12 days | 🔴 HIGH |
| Phase 2 | 4 features | 15-20 days | 🔴 HIGH |
| Phase 3 | 5 features | 18-24 days | 🟡 MEDIUM |
| Phase 4 | 2 features | 25-35 days | 🟡 MEDIUM |
| Phase 5 | Varies | Varies | 🔵 CONSIDER |

**Total for Phases 1-3:** ~50-70 days of focused development  
**With Phase 4:** ~75-105 days

---

## Next Steps

1. Review this roadmap and prioritize based on user feedback
2. Create GitHub issues for Phase 1 features
3. Set up project board for tracking
4. Start with highest-impact, lowest-effort features
5. Gather user feedback after each phase
6. Re-evaluate roadmap quarterly

---

## Notes

- All effort estimates assume single developer working full-time
- Estimates include implementation, testing, and documentation
- Some features may require service-side changes
- Consider breaking large features into smaller incremental releases
- User testing and feedback loops are crucial between phases

**Remember:** Cadence took years to reach its current state with 250,000+ users. BPT's competitive advantage is its unique streaming capabilities and simplicity, not trying to match Cadence feature-for-feature.
