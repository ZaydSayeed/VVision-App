# VVision-App Plans Overview

A plain-English summary of what each plan adds to the app. Plans must be executed in order where noted.

---

## Plan A — Living Profile Foundation ✅ MERGED
**What it adds:** The backend database and API that everything else depends on. Stores rich patient data (dementia stage, triggers, routines, history), family member access roles (who can see/edit what), and a memory layer that accumulates notes over time. No visible UI — this is the foundation the other plans build on.

---

## Plan B — Seats UI & Subscription
**What it adds:** Two things:
1. **Family management** — caregivers can invite siblings or other family members, see who has access, and accept invites from others.
2. **Subscription paywall** — Starter ($14.99/mo, 2 seats) and Unlimited ($24.99/mo) plans enforced via RevenueCat. Blocks certain features until subscribed.

**Depends on:** Plan A

---

## Plan C — Voice Check-ins (Gemini Live)
**What it adds:** A mic button in the app. Caregiver taps it, speaks for 30–60 seconds about how their parent is doing, and it automatically transcribes + saves key facts to the Living Profile. Falls back to text input if voice fails.

**Depends on:** Plan A

---

## Plan D — Sensors (Smart Home + Phone)
**What it adds:** Passive data collection from two sources:
1. **Smart home** — pulls data from HomeKit/Matter devices the family already owns (motion sensors, door sensors, etc.)
2. **Phone sensors** — captures general wellness signals from the caregiver's phone during check-ins.

All opt-in via a Settings → Sensors screen. iOS only in v1.

**Depends on:** Plan A

---

## Plan E — Patient Companion (Twilio Phone)
**What it adds:** A dedicated Vela phone number the patient can call from any phone (landline, flip phone, smartphone). The call connects to a voice AI that knows who they are, can answer their repetitive questions, and writes a summary of each call back to the Living Profile. Caregivers can review what their parent asked about.

**Depends on:** Plan A (and reuses Plan C's voice bridge)

---

## Plan F — Pattern Learning + Visit Prep
**What it adds:** Two automated features that use accumulated Living Profile data:
1. **Pattern detection** — a nightly job analyzes the last 30 days and surfaces recurring patterns (e.g., "4pm agitation on Tuesdays") as nudges in the app.
2. **Auto visit prep** — 3 days before a scheduled neurologist appointment, auto-generates a 2-page PDF summary (meds, mood trends, behavioral events, sibling notes) and sends it to the caregiver.

**Depends on:** Plan A

---

## Plan G — Onboarding & Trial Paywall
**What it adds:** The first-run experience for new caregivers. A step-by-step wizard (10–12 min) that takes someone from signup → a filled-out Living Profile of their parent, ending on a 7-day free trial paywall. Uses voice intake from Plan C where available, text otherwise.

**Depends on:** Plans A and B (required). Plans C and D optional — wizard degrades gracefully without them.

---

## Execution Order

```
A (done) → B → G    ← required chain
              ↑
         C, D, E, F can run in any order alongside B
```
