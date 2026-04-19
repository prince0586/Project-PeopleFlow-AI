# EventFlow AI - Agent Intelligence Directives

## 1. Quality Mandates
- **Strict Typing**: Never use `any`. All data structures must derive from `src/types.ts`.
- **TSDoc Standard**: Every exported function, interface, and component must have a JSDoc/TSDoc block explaining its role and constraints.
- **Component Architecture**: Prefer modularity. Large components (>200 lines) should be decomposed into sub-components or custom hooks.

## 2. Security Protocol (Zero-Trust)
- **Firestore Integrity**: All writes must pass the `isValidLog`, `isValidMessage`, or `isValidTokenSchema` helpers in `firestore.rules`.
- **Identity Locking**: Ensure `isOwner(userId)` is applied to all PII and sensitive user state.
- **Validation**: Use `Zod` in `server.ts` for every incoming request payload.

## 3. Google Ecosystem Guidelines
- **AI Implementation**: Use ONLY the modern `@google/genai` SDK on the frontend tier. Initialize with `process.env.GEMINI_API_KEY`.
- **Telemetry**: Log every significant interaction (routing, queuing) to the `AnalyticsService` (BigQuery-simulated ingestion).

## 4. Accessibility (WCAG 2.1)
- **Semantic HTML**: Use proper ARIA landmarks (`main`, `section`, `nav`, `footer`).
- **Focus Management**: All interactive elements must have visible focus rings and support keyboard navigation.
- **Theme Support**: Maintain high-fidelity support for 'light', 'dark', and 'high-contrast' modes.
