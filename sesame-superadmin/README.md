# SESAME — Back-office

React 19 + Vite. Staff interface: tickets (queue, conversation, internal notes, assignment), statistics (CSV/PDF export), news (drafts, scheduling, targeting, attachments), students (CSV import, password reset), categories, services, team.

```bash
cp .env.example .env.local   # VITE_API_URL=http://localhost:3000
npm install
npm run dev                  # http://localhost:5173
npm test && npm run lint && npm run build
```

Structure: `src/pages/` (one file per route), `src/components/ui/` (Button, fields, Modal, toasts, confirm…), `src/lib/` (API client, socket, formatting, URL-synced filters), `src/styles.css` (design tokens + classes).
