# B-3 Implementation Guide
## Module de Prise de RDV Téléphonique

**Date**: 2026-03-27
**Status**: ✅ Implémentée
**Architecture**: Calendly (iframe) → Webhook → Supabase appointments table

---

## 📋 What Was Implemented

### B-3a: UI - Appointment Booking Section
**File**: `espace-client.html` (lines 1894-1920)

- **Location**: New phase-section for phases 1-2 (new_lead, account_created)
- **Component**: Calendly embedded iframe at `https://calendly.com/scantorenov`
- **Features**:
  - Responsive Calendly calendar embed (700px height)
  - Conditional visibility using `data-min-phase="1" data-max-phase="2"`
  - Appointment status card (hidden until booking confirmed)
  - CSS styling for consistent look & feel

**CSS Classes Added**:
- `.appointment-booking-section` - Main container
- `.appointment-status-card` - Confirmation display after booking
- `.appointment-details` - Appointment details formatting

---

### B-3b: JavaScript - Client-Side Event Handling
**File**: `espace-client.html` (lines 4379-4479)

**Features**:
1. **Calendly postMessage Listener**
   - Listens for `calendly.event_scheduled` messages from iframe
   - Extracts appointment details (title, date/time)
   - Formats dates in French locale

2. **Appointment Status Display**
   - Fades out Calendly iframe after booking
   - Shows confirmation card with appointment details
   - Includes fade-in animation

3. **Backup Polling Function**
   - `checkAppointmentStatus()` queries Supabase for recent appointments
   - Runs on page load (500ms delay)
   - Detects appointments created in last 2 minutes
   - Provides redundancy if webhook is delayed

---

### B-3c: Backend - Webhook Handler
**File**: `netlify/functions/book-appointment.js`

**Purpose**: Receives Calendly webhook POST events and records appointments in Supabase

**Flow**:
1. Calendly sends webhook POST: `POST https://<site>/.netlify/functions/book-appointment`
2. Handler extracts appointment data:
   - `invitee.email` → Client email
   - `scheduled_event.start_time` → Appointment date/time
   - `scheduled_event.duration_minutes` → Duration
   - Client name, notes

3. Handler performs:
   - Email lookup in `clients` table
   - INSERT into `appointments` table with:
     - `type`: 'phone_call'
     - `status`: 'requested'
     - `location`: 'phone'
     - `notes`: Includes Calendly booking info

4. Returns 200 OK to Calendly with appointment ID

**Error Handling**:
- Validates presence of required fields
- Returns 404 if client email not found in database
- Returns 500 for database errors with details
- Comprehensive console logging for debugging

---

## 🔌 Setup Instructions

### 1. Calendly Webhook Configuration
1. Go to: https://calendly.com/app/settings/event_types
2. Select your event type (phone call appointment)
3. Go to "Integrations" → "Webhooks"
4. Add new webhook:
   - **URL**: `https://your-netlify-site.netlify.app/.netlify/functions/book-appointment`
   - **Events**: `invitee.created` (when someone books)
   - **Status**: Active

### 2. Database Prerequisites
Ensure the `appointments` table exists in Supabase:
```sql
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'requested',
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Netlify Function Deployment
- Function is at: `netlify/functions/book-appointment.js`
- Requires `@supabase/supabase-js` package (should already be in dependencies)
- Environment variables (configured in Netlify dashboard):
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

---

## 🧪 Testing Checklist

- [ ] **UI Display**: Appointment booking section visible on phases 1-2
- [ ] **Calendly Embed**: Iframe loads and is responsive
- [ ] **Mock Booking**: Test booking in Calendly sandbox
- [ ] **Webhook**: Verify POST is sent to webhook handler
- [ ] **Database**: Check appointments table for new record
- [ ] **Status Display**: Confirmation card shows after booking
- [ ] **Phone Polling**: Verify status polling works as fallback
- [ ] **Error Cases**:
  - Test with non-existent client email
  - Test with malformed webhook payload
  - Verify error logging in Netlify function logs

---

## 📊 Pipeline Phases Flow

```
Phase 1 (new_lead)          Phase 2 (account_created)       Phase 3 (call_requested)
     ↓                            ↓                                ↓
[Appointment Booking] ──→ [Waiting for availability] ──→ [Call Scheduled]
 (B-3a: Calendly UI)       (B-3c: Webhook capture)        (Rendered: scheduled_at)
     ↓
[User selects time]
     ↓
[Calendly sends webhook]
     ↓
[book-appointment.js runs] ──→ INSERT into appointments table
```

---

## 🔄 Data Flow

```
User Action: Selects time in Calendly
    ↓
Calendly Calendar Closed (invitee.created event)
    ↓
Calendly webhook POST → book-appointment.js
    ↓
Extract: email, scheduled_at, duration
    ↓
Query clients table → GET client_id from email
    ↓
INSERT appointments record:
  {
    client_id: UUID,
    type: 'phone_call',
    status: 'requested',
    scheduled_at: TIMESTAMPTZ,
    duration_minutes: INT,
    location: 'phone',
    notes: 'Scheduled via Calendly...'
  }
    ↓
Return 200 OK to Calendly
    ↓
JavaScript detects booking (postMessage or polling)
    ↓
Show confirmation card with appointment details
```

---

## 🚀 Next Steps (B-4)

After B-3 is deployed and tested:
1. **B-4a**: Update dashboard to show scheduled appointments
2. **B-4b**: Implement confirmation email to client
3. **B-4c**: Create `confirm-appointment.js` to mark status as 'confirmed'
4. **B-4d**: Update phase pipeline to move client to phase 4 after confirmation

---

## 📝 Notes

- **Calendly Account**: https://calendly.com/scantorenov
- **Timezone Handling**: Calendly sends ISO 8601 UTC timestamps, stored directly in appointments table
- **RGPD Compliance**: Calendly is RGPD compliant and handles consent properly
- **Client Lookup**: Requires client email to already exist in database (from B-1, B-2 flow)
- **Fallback Mechanism**: JavaScript polling provides redundancy if webhook is delayed/fails

---

## 🐛 Troubleshooting

### Appointment not appearing in database
1. Check Netlify function logs: `https://app.netlify.com/[site]/functions`
2. Verify Calendly webhook is configured correctly
3. Check client email exists in `clients` table
4. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in Netlify

### Webhook not being called
1. Test Calendly webhook in dashboard → "Test" button
2. Check if client who booked exists in database
3. Verify webhook URL is accessible (check for 404s)
4. Check Calendly event type is active and booking is enabled

### Confirmation card not showing
1. Check browser console for JavaScript errors
2. Verify Calendly postMessage is being sent (check browser Network tab)
3. Ensure JavaScript functions are loaded after DOM
4. Try refreshing page (fallback polling should catch it)

---

Generated: 2026-03-27
