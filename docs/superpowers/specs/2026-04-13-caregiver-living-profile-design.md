# Caregiver Pivot — Living Profile Design Spec

**Date:** 2026-04-13
**Status:** Draft — pending user review
**Owner:** Vela Vision team
**Related:** BRAIN `Project Docs/VelaVision Strategic Pivot.md`

## Overview

Pivot the VVision-App from a patient+caregiver feature bundle into a **caregiver-first product built around one Living Profile of the patient**. Every feature reads from and writes to a shared, patient-scoped memory layer. The profile is the moat; the features are expressions of it.

This spec locks scope for v1. V2+ items are named so they aren't lost, but won't ship in v1.

## Background — why this pivot

After the Ayman advisor sync (2026-04-11) the company shifted from patient-first glasses hardware to a caregiver-first app for adult children (45–65) of dementia patients. Glasses become V2. Hardware risk is replaced by a three-angle validation stack (clinical data + waitlist + paying app users).

Competitive research (2026-04-13) across 15+ shipping apps — Caring Village, Lotsa Helping Hands, Alzheimer's Care Partner, Amicus Brain, KindredMind, ElliQ, Kathy/CloudMind, and others — confirmed a clear gap: every shipping product is a **toolkit of disconnected features** (shared calendar, generic AI chatbot, patient companion, stage assessment). None has built the **connective tissue** that makes those features one brain. Evidence:

- PubMed large-scale Reddit analysis: emotional support is #1 caregiver need (50% of posts), 13× more likely to be unmet AND digitally addressable than any other category.
- JMIR mixed-methods 2025: zero participants use tech for emotional support; caregivers want a "centralized hub" and reject fragmentation.
- Direct teardown of Alzheimer's Care Partner ($9.99/mo, closest competitor): has AI chat, stage assessment, family coordination, and visit prep — but the features don't talk to each other. The AI doesn't know Mom. The assessment doesn't inform the AI's advice.

Vela's bet is that the substrate (shared Living Profile + AI memory layer) is more defensible than any single feature.

## Target user

- **Primary buyer and user:** Adult child, 45–65, caring for a parent with mild-to-moderate dementia. Median household net worth $364–410K. Holds the primary phone. Owns the decision.
- **Secondary user (role-tagged seats):** Sibling (long-distance, weekend), paid aide, clinician (v2).
- **Tertiary user:** The patient herself — only via the voice companion (phone number), never required to install an app.

Design corollary: **the adult child must be able to onboard and derive value completely alone.** Anything that requires the patient to authenticate, tap through, or install something dies at conversion.

## V1 scope — locked

### Core substrate
- **Living Profile of the patient.** One per patient. Structured facts (identity, stage, history, triggers, routines, meds, providers, voiceprint) + Mem0-backed unstructured memory (every note, transcript, event, pattern). Patient-scoped, shared across all seats on the profile.

### Surfaces (the five things the profile powers)
- **Coach AI** — voice-first assistant that cites specifics from the profile. "She responded to the photo album last Tuesday. Want me to pull it up?"
- **Patient Voice Companion** — dedicated Vela phone number. Patient calls from any phone (landline, flip phone, smartphone). Gemini Live agent answers, grounded in the profile. Repetition-tolerant, validation-therapy tone. Summary of each call writes back to the profile.
- **Sibling Circle** — role-tagged seats sharing the same profile. Primary caregiver sees the full daily view; long-distance sibling defaults to the weekly digest. One truth across the family.
- **Pattern Learning** — nightly inference job surfaces recurring patterns ("Tuesday 4pm agitation peak," "Aunt Carol calms her," "sleep worse after PT days"). Surfaced as gentle nudges in the Coach view.
- **Auto Visit Prep** — three days before a scheduled neurologist visit, app generates a 2-page clinical summary PDF from the profile: meds adherence, behavioral events, sleep, mood, sibling notes. Downloadable and shareable.

### Sensing avenues feeding the profile
- **Smart-home ambient feed.** Matter/HomeKit/Google Home integration. Pulls motion, presence, sleep, door-open events from sensors the family already owns. Zero new hardware. Writes to profile as passive events.
- **Smartphone passive biomarkers.** `expo-sensors` on the caregiver's phone: gait from accelerometer during the daily check-in, voice samples (prosody/tremor), typing cadence. Framed as a 30–60 second daily check-in, not a clinical measurement. FDA General Wellness positioning.
- **Family inputs.** Voice-first check-ins via Gemini Live. Text notes, photos. Every input writes to the profile's Mem0 layer.

### Monetization (v1)
- **Starter:** $14.99/mo — primary caregiver + 1 sibling seat. Hard paywall after 7-day free trial.
- **Unlimited:** $24.99/mo — unlimited sibling seats on the same patient profile.
- Annual option at standard ~17% discount: $149/yr Starter, $249/yr Unlimited.
- Subscriptions via RevenueCat for app-store billing (handles Apple/Google IAP). Stripe only if/when a web signup path is added later.

## V2+ deferred (named so nothing is lost)

- **Caregiver burnout detection** (Hume EVI voice emotion analysis during check-ins, weekly private trend to the caregiver).
- **Reminiscence content auto-generation** (profile-grounded photo collages, playlists, short videos).
- **RTM billing partnership** — CPT 98977/98980 via a neurology partner, ~$90 PMPM, split with Vela. Requires HIPAA BAA, a clinical partner agreement, and documented 16+ days of monitoring data per patient.
- **Research data licensing rail** — Datavant tokenization, Expert Determination de-identification, opt-in consent with revocation, points-for-participation. Needs N ≥ 500 paying households before first pharma conversation.
- **Vela Glasses integration** — glasses become another sensor feeding the profile. Post-clinical-validation only.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  SURFACES  (React Native / Expo)                           │
│  Coach AI · Patient Companion (phone) · Sibling Circle     │
│  · Pattern Nudges · Auto Visit Prep                        │
└──────────────────────────▲─────────────────────────────────┘
                           │ read / write
┌──────────────────────────▼─────────────────────────────────┐
│                 🧠 LIVING PROFILE OF MOM                    │
│  Mem0 memory layer + structured facts (MongoDB)            │
│  · one patient context · shared across all seats           │
│  · nightly pattern inference job · HIPAA-ready isolation   │
└──────────────────────────▲─────────────────────────────────┘
                           │ feeds
┌──────────────────────────▼─────────────────────────────────┐
│  SENSORS                                                   │
│  Matter/HomeKit bridge · expo-sensors biomarkers           │
│  · Gemini Live voice check-ins · notes / photos            │
└────────────────────────────────────────────────────────────┘

Backend: Express + TypeScript on Render (existing)
Auth:    Supabase (existing)
DB:      MongoDB Atlas (existing) + Mem0 SaaS (new)
Voice:   Gemini Live for real-time · Twilio + Gemini Live for
         the patient companion phone-number endpoint (new)
```

### Key architectural moves

1. **One Living Profile per patient, not per caregiver.** Every family member authenticates individually, but all seats read/write the same patient-scoped profile. This is the inversion every existing caregiver app missed.
2. **Mem0 as the memory layer, not DIY.** Enterprise tier has HIPAA BAA. Handles extraction, dedup, semantic retrieval that would take a quarter to build in-house.
3. **Patient companion = a phone number, not a screen.** Patient doesn't install anything. Mom dials a dedicated Vela number from any phone; a Twilio voice webhook hands the call to a Gemini Live agent grounded in her Living Profile.
4. **Existing VVision-App stack carries ~70% of the work.** React Native + Expo + Supabase + MongoDB + Express on Render are already live. Net-new: Mem0 SDK, Matter bridge, Gemini Live SDK, Twilio voice flow, expo-sensors pipeline, RevenueCat subscription.

## Data model

```
Profile (one per patient)
  id                  stable UUID
  identity            name, DOB, photo, relationships (spouse/children/etc.)
  stage               mild | moderate | severe  +  progression timeline
  history             biography, culture, faith, music, era preferences
  triggers            known agitation triggers + what has worked historically
  routines            daily rhythms, meals, meds, therapy, sleep
  medications[]       dose, schedule, prescriber, adherence events
  providers[]         neurologist, PCP, pharmacist, home aide
  voiceprint?         optional sample for companion-call personalization
  createdAt / updatedAt

Memory (Mem0-backed, unstructured)
  profileId           scope key — every memory is patient-scoped
  events              every check-in, companion-call summary, smart-home
                      event, biomarker reading, sibling note
  patterns            nightly-inferred ("Tuesday 4pm agitation")
  retrieval           semantic — Coach AI queries by natural language

Seat (access control)
  userId              Supabase user id
  profileId           which patient this seat is for
  role                primary_caregiver | sibling | paid_aide | clinician
  defaultView         full-daily | weekly-digest | clinical

Subscription
  profileId           billed per patient profile, not per user
  tier                starter (2 seats) | unlimited
  status              trialing | active | past_due | canceled
  trialEndsAt
```

Every seat on a profile shares the same Mem0 context. Patient memory is never mixed across profiles. Deletion of a profile cascades to memory, events, subscription records.

## Key user flows

1. **Onboarding (adult child, 10–12 min, solo).** Signup → voice-guided intake ("Tell me about your mom") → invite siblings (optional, skippable) → connect smart home (Matter one-tap, optional) → 7-day trial unlocks.
2. **Daily check-in (adult child, 2 min).** Opens app → "How's Mom today?" voice prompt → 30–60s answer → Vela writes to memory, surfaces weekly trend, highlights any emergent pattern.
3. **Crisis moment (adult child, real-time).** Mom agitated → caregiver taps Coach → voice response cites what worked last time → caregiver picks action → outcome logged, profile learns.
4. **Patient companion call (patient, any phone).** Mom calls dedicated Vela number → Gemini Live agent grounded in profile answers warmly → handles repetitive questions → call summary writes back to profile + notifies family.
5. **Doctor visit prep (adult child, 3 days before).** Notification → "Dr. Patel visit Thursday. Tap to generate summary." → app produces 2-page clinical PDF.
6. **Long-distance sibling digest (sibling, weekly).** Sunday push/email: "This week with Mom." AI-summarized from the profile, 2-paragraph read, one-tap to drill in.

## Risks & open questions

- **Patient companion legal posture.** Call recording laws vary by state (California, Florida, Illinois, PA, WA, MA, MD are all-party-consent). v1 must obtain explicit consent from the legally authorized representative at enrollment; this is blocking for the companion launch in those states. Counsel review required.
- **Emotional tone of "digital twin" framing.** Caregivers reject tech that feels like it replaces invisible emotion work. Public framing must be "shared brain" or "Mom's profile," never "digital twin." Copy should emphasize supporting the human, not replacing her.
- **FDA General Wellness line.** Smartphone biomarker framing must stay in wellness scope. Allowed: "Track memory and mood trends." Disallowed: "Screens for Alzheimer's," "Detects progression." Every piece of product copy needs a wellness-claim gate before ship.
- **Mem0 data residency and BAA.** Enterprise tier required for HIPAA. Must be signed before the first real patient profile touches production.
- **Pricing elasticity.** $14.99 Starter is an educated bet between $9.99 (disposable) and $29 (medical-alert anchor). Validate with live trial-to-paid data in the first 30 days and be willing to move.
- **Churn ceiling.** Parent moves to memory-care or passes → cancellation. Industry ceiling is ~12–18 months of active paying tenure. This is immovable and must be baked into LTV math. Family Plan conversion is the single biggest retention lever.

## Success criteria (first 90 days post-launch)

- Onboarding completion: 60%+ of trial signups reach first voice check-in
- Trial-to-paid conversion: 10%+ (hard paywall benchmark is 12.1% median)
- Weekly active caregivers: 70%+ of paid subscribers in month 1
- Sibling attach rate: 40%+ of paid households add at least one sibling seat
- First patient companion call completed: 25%+ of paid households within 30 days
- Doctor visit prep generated: 15%+ of paid households within 60 days

## Out of scope

- Any patient-facing app install
- VR/AR reminiscence (hardware bottleneck)
- Cognitive screener with disease claims (needs 510(k); wellness-only in v1)
- Trial recruitment UX (needs cohort)
- Employer B2B2C sales motion (Year-2 path)
- Medicare Advantage distribution (Year-2 path)

## Next step

Implementation plan via the `superpowers:writing-plans` skill once this spec is approved.
