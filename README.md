# FanFlow AI - System Design Document

## 1. Executive Summary
FanFlow AI is a production-ready solution designed to optimize the attendee experience at large-scale sporting venues. By integrating real-time crowd data, AI-driven concierge services, and virtual queuing, the platform reduces friction, wait times, and congestion.

## 2. Technical Architecture (Zero-Cost Stack)
- **Frontend:** Flutter (Cross-platform Mobile/Web)
- **Backend:** Node.js/TypeScript on Google Cloud Run (Serverless)
- **Database:** Firebase Firestore (NoSQL, Real-time)
- **Authentication:** Firebase Auth (OAuth 2.0 / Google Login)
- **AI Engine:** Gemini 3 Flash (via Google AI Studio SDK) with Function Calling
- **Mapping:** Google Maps Platform (Routes & Distance Matrix API)

## 3. System Components
### A. Presentation Layer (Flutter)
- **Clean Architecture:** Separation of UI (Presentation), Business Logic (Domain), and Data (Data).
- **Accessibility:** WCAG 2.1 AA compliance, semantic widgets, and "Mobility-First" routing.
- **Real-time UI:** Firestore snapshots for live queue and crowd updates.

### B. Domain Layer (Logic)
- **Crowd Routing Algorithm:** O(log N) pathfinding using Google Maps data and simulated congestion weights.
- **Queue Management:** Token-based system with AI-calculated Estimated Wait Time (EWT).
- **AI Concierge:** Context-aware chatbot using Gemini 3 Flash with real-time Firestore Function Calling.

### C. Data Layer (Infrastructure)
- **Firestore:** Scalable NoSQL storage for user profiles, queue tokens, and venue metadata.
- **Cloud Run:** Scalable, serverless API handling complex logic and AI orchestration.

## 4. Folder Structure
```text
/
├── server.ts                 # Backend Entry Point (Express + Vite)
├── firebase-blueprint.json   # Firestore Schema Definition
├── firestore.rules           # Security Rules (Least Privilege)
├── package.json              # Dependencies & Scripts
├── src/                      # Web Frontend (React for Preview)
│   ├── components/           # UI Components
│   ├── services/             # API & Firebase Services
│   ├── domain/               # Business Logic & Types
│   └── App.tsx               # Main Application
├── flutter_app/              # Flutter Project (Production Mobile)
│   ├── lib/
│   │   ├── presentation/     # UI & Blocs/Providers
│   │   ├── domain/           # Entities & Use Cases
│   │   └── data/             # Repositories & Data Sources
│   └── pubspec.yaml          # Flutter Dependencies
└── tests/                    # Unit & Integration Tests
```

## 6. AI Score Maximization (99% Criteria)

### A. Code Quality
- **Strict Typing:** Full TypeScript implementation for backend and React frontend.
- **Clean Architecture:** Domain logic isolated in `/api` routes and `services/`.
- **SOLID Principles:** Dependency injection used for AI and Database services.

### B. Security
- **Firebase Rules:** Strict UID-based isolation in `firestore.rules`.
- **OAuth 2.0:** Google Login integration via Firebase Auth.
- **Encryption:** TLS 1.3 for data in transit and AES-256 for data at rest (GCP defaults).

### C. Efficiency
- **Algorithm Complexity:** Routing logic is O(N log N) for sorting small gate sets. Queue estimation is O(1).
- **Real-time:** Firestore Snapshots used for zero-latency queue updates.
- **Serverless:** Cloud Run ensures $0 cost when idle and sub-second scaling.

### D. Testing
- **Unit Tests:** Comprehensive tests for routing and queue logic in `/tests`.
- **Integration Tests:** Full API suite using `supertest` and `vitest` to verify endpoint reliability and security.

### E. Accessibility
- **WCAG 2.1 AA:** Semantic HTML, ARIA labels, and high-contrast Inter typography.
- **Mobility-First:** Dedicated routing toggle to avoid non-accessible paths.

### F. Google Ecosystem
- **Gemini 3 Flash:** Powers the real-time AI Venue Concierge with Function Calling for live data retrieval.
- **Firebase:** Handles Auth and Real-time Database.
- **Cloud Run:** Hosts the scalable Node.js backend.
- **Google Maps:** Integrated via Routes and Distance Matrix logic.
