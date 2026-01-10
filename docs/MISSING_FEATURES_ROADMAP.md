# Missing Features Roadmap

## Advanced Features (Longer Term)

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



