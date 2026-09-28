# OneCase: Joined-Up Student Support

**ServiceNow Co-Innovation Day · Vasavi · Track 3: Joined-Up Case Management**

> One student → one case → only the relevant departments → shared progress → resolution.

## Run it

```bash
cd onecase
npm install          # first time only
npm run dev          # starts the web app (5173) + AI server (8787)
```

Open http://localhost:5173

### Turn on the AI (Groq)
1. Copy `server/.env.example` to `server/.env`.
2. Paste your key from https://console.groq.com/keys into `GROQ_API_KEY=`.
3. Restart `npm run dev`. The footer pill should read **✨ AI online · Groq**.

The key stays on the server and never reaches the browser. If the AI is unavailable, the app says so, and the rule-based department matching still works.

## Database (SQLite)
- All accounts, cases, tasks, timeline entries and notes are stored in **`server/data/onecase.db`**. The file is created and filled with demo data on the first run.
- Tables: `users`, `sessions`, `cases`, `tasks`, `timeline`, `notes`. Passwords are stored hashed (scrypt).
- Access rules are enforced **on the server**:
  - Students get only their own cases, with internal staff notes removed.
  - Staff get only cases that involve their department and can update only their own department's task.
  - The coordinator sees all cases.
- The app checks for updates every 3 seconds, so a phone and a laptop stay in sync.
- It uses `sql.js` (SQLite compiled to WebAssembly), so there's no native build step and `npm install` works everywhere.
- To start fresh, click **Reset demo** in the footer, or stop the server and delete `server/data/onecase.db`.

### Session booking and reviews
- **Booking:** from My Case, a student books a 30-minute session with each team on their case. Slots run Mon–Sat, 10:00–13:00 and 14:00–16:00, for the next 6 working days. They can reschedule or cancel.
- **No clashes, enforced by the database** (unique indexes on the `bookings` table):
  - A department slot can be held by only **one student**. Others see it as *Taken*, without seeing who has it.
  - A student can't have **two sessions at the same time**. That slot shows *Busy: Counseling*.
  - Even two students pressing Book at the same moment can't double-book: exactly one wins.
- A team that is *Waiting* on another team can't be booked until it becomes Ready.
- **Reviews:** once a team marks its task Completed, the student can rate it (1–5 stars plus an optional comment). Staff see reviews on the case and on their dashboard, and the coordinator sees each department's average rating.
- Demo data includes 3 booked sessions on the next working day and 2 reviews on case #1023.

### Academic database (Academic Support only)
- **Tables:**
  - `academic_records`: roll, name, branch, year joined, CGPA, attendance.
  - `activities`: hackathons, coding contests, tech fests, workshops and paper presentations, with results.
- **Roll format:** `1602-YY-BBB-NNN`. Branch codes are **733 CSE, 737 IT, 735 ECE**, e.g. `1602-24-733-005`. It's validated at sign-up (the form decodes branch and year live) and by a database CHECK constraint.
- **Auto-fetch:** when a student's case includes Academic Support, the record is looked up by the student's roll number. The timeline notes "Academic record linked". The Academic staff case page shows name, roll, branch, year, CGPA, attendance (flagged under 75%) and all events.
- **Academic Records page** (Academic account only): the whole database with search, branch filter, and expandable rows.
- **Access:** only the logged-in **Academic Support account** can read it. Counseling, the coordinator, students, and the demo department switch all get "403 Forbidden".
- **Demo tip:** sign up as a new student with roll **1602-24-733-005** (Priya Sharma: 69% attendance, 3 hackathons, no wins), tell the commute story, include Academic Support, then log in as `academic@vasavi.edu`.

### Demo from a phone
`npm run dev` prints a **Network** address (e.g. `http://192.168.x.x:5173`). Open it on a phone on the same Wi-Fi and submit a request as a student, then watch it appear live on the staff laptop. Windows may ask to allow Node.js through the firewall; allow it on private networks.

## Accounts (one login page for everyone)
- **Students** sign up with name, college email, roll number and password, or use a demo account.
- **Staff don't sign up.** Their accounts are pre-created with a department, and the department decides which cases they see.
- **Coordinator** sees every case, read-only.

| Demo account | Role | Password |
|---|---|---|
| `ananya@vasavi.edu` | Student (owns #1024) | `demo123` |
| `student@vasavi.edu` | Student (owns #1026) | `demo123` |
| `counseling@vasavi.edu`, `academic@vasavi.edu`, … (all 12, e.g. `financial@`, `career@`) | Staff | `demo123` |
| `coordinator@vasavi.edu` | Coordinator | `demo123` |

The login page has one-click buttons for these. Staff pages keep a **"Demo switch"** department dropdown so you can hop between teams live. In production the department comes only from the login (university SSO).

## Demo script (about 3 min)
1. **Home:** "12 departments, 40% more referrals, 3-week waits." The collage shows one case connected to only 2 of the 12 teams.
2. **Sign up as a new student, then Get Support.** Your name and roll number are filled in from your account.
   - Type in your own words: *"I've been falling behind on assignments for weeks and feel really overwhelmed."*
   - Pick Academic + Emotional, then submit.
3. **Review:** the ✨ AI suggestions and the rule-based results appear side by side, each with reasons. Confirm, and a new case is created (e.g. #1027).
4. **Log out, then log in as Counseling staff (one click):**
   - Open **Case #1024**.
   - Click **✨ Brief me** to get the AI case brief.
   - Set the task to **Completed**, add a note, then click **✨ Write it for the student** and **Update shared case**.
5. **See the student's view:** Counseling shows ✅, Academic is still 🔵, and the overall status is In Progress.
6. **Switch department to Academic Support:** on the same Case #1024, set it to Completed. The overall status becomes **Resolved** 🟢.
7. **Dependency:** in **Case #1026** as Counseling, complete the assessment. Academic Support switches automatically from **Waiting** to **Ready**.
8. **Privacy:** switch to Career Services. It shows no cases, because only involved teams can see a case.
9. **Coordinator:** live counts and the workload of all 12 departments.

Use **Reset demo** in the footer to restore the starting data. Tip: open two browser windows side by side (student and staff) and they stay in sync.

## What's where
| Path | What it does |
|---|---|
| `src/state/caseLogic.js` | Overall status, dependency unlock, next action |
| `src/state/CaseStore.jsx` | Shared case data (one source for the student and staff views) |
| `src/lib/recommend.js` | Rule-based department matching and the crisis keyword check |
| `server/index.js` | Groq endpoints: `/api/ai/triage`, `/api/ai/brief`, `/api/ai/rewrite` |
| `src/pages/*` | Home, GetSupport, Recommend, MyCase, StaffDashboard, MyTasks, CaseView, Coordinator |

All data is fictional.
