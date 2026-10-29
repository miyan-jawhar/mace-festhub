# MACE EventHub — Campus Event Management & Registration Platform

> **Web Programming Lab — Experiment 11**  
> B.Tech Computer Science and Engineering (Data Science)  
> Mar Athanasius College of Engineering (MACE)

A full-stack campus event management and registration platform built with **Node.js, Express, and MongoDB Atlas**. The system handles institutional governance, multi-tier approvals, role-based workflows, automated queue management, digital ticketing, payment processing, calendar synchronization, and Google Gemini AI integration.

---

## 🏛️ System Architecture & Workflow

MACE EventHub implements a decentralized governance model that mirrors collegiate administration:

```
[Student Officer Candidate]
          │
          ▼ (Applies for President/Secretary via Signup or Profile)
[Faculty Advisor (FA)]
          │ (Reviews leadership statement, appoints Club President)
          ▼
[Club President]
          │
          ▼ (Proposes event with AI tags & description polishing)
[Faculty Advisor (FA)]
          │ (Vets event proposal, curriculum alignment & feasibility)
          ▼ (Status: pending_principal)
[Principal / Admin]
          │ (Final institutional sanction & safety verification)
          ▼ (Status: approved)
[Event Published & Live]
          │
          ├─► Automated Email Alerts to Students with Matching Track Interests
          ├─► Student Registration (Razorpay Checkout / Free RSVP)
          ├─► Digital Ticket Generation (QR Code + PDF Download + Email)
          ├─► Google Calendar Sync (.ics export & OAuth integration)
          └─► Automated Waitlist Queue & Real-Time Promotion on Cancellation
```

---

## 🚀 Key Engineering Features

### 1. Multi-Tier Institutional Governance
- **Role-Based Access Control (RBAC):** Distinct roles for `student`, `faculty_advisor`, `principal`, and `admin` with secure JWT authentication and role-guarding middleware.
- **Smart Institutional Email Classification:** Dynamic regex detection on registration identifying student roll numbers (`bYYdeptNNN@mace.ac.in`) versus faculty credentials (`name@mace.ac.in`), tailoring registration fields automatically.
- **Faculty Advisor Onboarding:** Faculty request club advisorship upon login; the Principal reviews notes and approves or reassigns club advisors.
- **Club Officer Applications:** Students apply for Club President or Secretary positions with motivation statements; the club's assigned Faculty Advisor evaluates and appoints officers.
- **3-Tier Proposal Approval Pipeline:** Club Presidents draft proposals with Gemini AI enhancement; proposals route sequentially through Club FA vetting (`pending_fa`) to Principal final sanction (`pending_principal`) before going live.
- **Principal Club & User Governance:** The Principal can dynamically create clubs, assign Faculty Advisors, remove clubs, and manage user roles from the unified administration dashboard.

### 2. High-Concurrency Registration & Waitlist Engine
- **Atomic Capacity Tracking:** Uses MongoDB `$inc` operators and atomic transitions to eliminate race conditions under concurrent bookings.
- **Automated Waitlist Promotion:** When a confirmed attendee cancels, the first student in the waitlist queue is promoted to `confirmed`, and all subsequent queue positions decrement atomically.
- **Double-Booking & Fraud Prevention:** Compound unique indexes `(eventId, email)` and `(applicant, club, requestedRole)` enforce integrity at the database layer.

### 3. Ticketing, Payments & Verification
- **E-Ticket Engine:** Generates signed, cryptographically random ticket tokens (`EVT-XXXXXXXX`) encoded into dynamic QR codes (`qrcode`) and downloadable PDF tickets built with `pdf-lib`.
- **Gate Scanner Interface (`/verify.html`):** Fast, lightweight ticket validation terminal for event organizers to scan attendee QR codes and confirm entry in real time without login requirements.
- **Payment Gateway Integration:** Integrated with Razorpay test mode for fee collection, verifying order signatures and handling transactional flows.
- **Multi-Channel Delivery:** Automated email confirmations and PDF e-ticket attachments dispatched via Nodemailer.

### 4. Personalization & Artificial Intelligence
- **Interest Track Tagging:** Tag taxonomy for technical, cultural, workshop, and sports tracks. Students subscribe to interest themes during signup or profile editing.
- **Targeted Event Dispatch:** Publishing an approved event automatically queries matching student profiles and dispatches customized email notifications.
- **Google Gemini AI Tagging & Polish:** Event proposals leverage Google Gemini to analyze event drafts, recommend relevant track tags, and format descriptions for publication.
- **EventBot Assistant:** In-app floating AI chatbot grounded in live database records to answer student questions regarding event schedules, venues, deadlines, and registration procedures.

### 5. Calendar & Productivity Integrations
- **Google Calendar OAuth:** Synchronize registered events directly to Google Calendar.
- **Standardized iCalendar (.ics) Export:** Download universal `.ics` files compatible with Apple Calendar, Outlook, and mobile calendar applications.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Runtime & Backend** | Node.js (v18+), Express.js 4.x |
| **Database & ODM** | MongoDB Atlas (Cloud Cluster), Mongoose 8.x |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, Passport.js (`passport-google-oauth20`) |
| **Generative AI** | Google Gemini API (`@google/genai` REST integration with automatic model fallback) |
| **PDF & QR Generation** | `pdf-lib`, `qrcode` |
| **Communications** | Nodemailer (SMTP transport with Gmail App Passwords & console fallback) |
| **Payments** | Razorpay SDK (Test Mode / Mock Gateway) |
| **Calendar** | `googleapis` (Calendar v3), RFC 5545 iCalendar standard |
| **Frontend** | Vanilla HTML5, Modern CSS (Glassmorphism design tokens, Inter typography), Modular ES6 JavaScript |

---

## 📁 Repository Structure

```
Web Programming/
├── controllers/
│   ├── aiController.js                # Gemini AI tag suggester & EventBot endpoints
│   ├── authController.js              # Authentication, profile management & user admin
│   ├── clubController.js              # Club CRUD, FA assignment & member roster
│   ├── clubOfficerRequestController.js# Student officer application & FA review workflow
│   ├── eventController.js             # Public event discovery, detail views & filtering
│   ├── faRequestController.js         # Faculty Advisor nomination & Principal review
│   ├── proposalController.js          # Event proposal submission & 3-tier approval stages
│   ├── registrationController.js      # Booking engine, waitlist queue & auto-promotions
│   ├── tagController.js               # Event track tag taxonomy CRUD
│   └── ticketController.js            # QR code generation & ticket verification
├── middleware/
│   └── auth.js                        # JWT verification & multi-role authorization guards
├── models/
│   ├── Club.js                        # Club schema with FA reference & member roles
│   ├── ClubOfficerRequest.js          # Officer application schema with review notes
│   ├── Event.js                       # Live event schema with capacity counters & tags
│   ├── FARequest.js                   # FA application schema with review trail
│   ├── Proposal.js                    # Multi-tier approval proposal lifecycle schema
│   ├── Registration.js                # Attendee record with ticket token & waitlist index
│   ├── Tag.js                         # Topic/interest tag schema
│   └── User.js                        # User account schema with hashed credentials & roles
├── public/
│   ├── css/
│   │   └── style.css                  # Unified dark-mode design system & animations
│   ├── js/
│   │   ├── admin.js                   # Legacy admin portal client logic
│   │   ├── auth.js                    # Client-side session management & nav rendering
│   │   ├── events.js                  # Event discovery, filtering & Razorpay checkout
│   │   ├── login.js                   # Dynamic email detection, auth tabs & officer signup
│   │   └── profile.js                 # Unified dashboard (registrations, proposals, approvals)
│   ├── admin.html                     # Admin management console
│   ├── index.html                     # Main portal & event discovery homepage
│   ├── login.html                     # Authentication portal (Login & Register)
│   ├── profile.html                   # Multi-role user dashboard & approval center
│   └── verify.html                    # Gatekeeper ticket verification terminal
├── routes/
│   ├── ai.js                          # Gemini AI routing
│   ├── auth.js                        # Authentication & profile routes
│   ├── clubOfficerRequests.js         # Club officer application endpoints
│   ├── clubs.js                       # Club management endpoints
│   ├── events.js                      # Event catalog endpoints
│   ├── faRequests.js                  # FA request review endpoints
│   ├── proposals.js                   # Proposal approval workflow endpoints
│   ├── registrations.js               # Event registration & cancellation endpoints
│   ├── tags.js                        # Tag query endpoints
│   └── tickets.js                     # Ticket and QR verification endpoints
├── utils/
│   ├── calendarService.js             # Google Calendar API & iCal (.ics) generator
│   ├── emailService.js                # Nodemailer notification templates
│   ├── geminiService.js               # Gemini API client with fallback cascade
│   └── ticketService.js               # Token generation & PDF e-ticket compiler
├── .env.example                       # Environment configuration template
├── package.json                       # Project manifests & scripts
├── seed.js                            # Comprehensive database seeding utility
└── server.js                          # Express application entrypoint
```

---

## ⚡ Setup & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: MongoDB Atlas cluster URI or local MongoDB instance

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/miyan-jawhar/mace-festhub.git
cd mace-festhub
npm install
```

### 3. Environment Configuration
Copy the configuration template and populate your environment variables:
```bash
cp .env.example .env
```

Key configuration parameters in `.env`:
```env
# Database
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/mace_festhub?retryWrites=true&w=majority
PORT=3000
JWT_SECRET=your_jwt_secret_here

# App URL
APP_URL=http://localhost:3000

# Principal Root Credentials
PRINCIPAL_EMAIL=principal@mace.ac.in
PRINCIPAL_PASSWORD=principal2026
PRINCIPAL_NAME=Principal

# Google Gemini AI (Required for AI Tagging & EventBot)
GEMINI_API_KEY=your_gemini_api_key_here

# Nodemailer Email Notifications (Optional - logs to console if omitted)
GMAIL_USER=your_college_email@gmail.com
GMAIL_APP_PASSWORD=xxxx_xxxx_xxxx_xxxx

# Razorpay Test Gateway (Optional for paid ticket testing)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret

# Google OAuth & Calendar Sync (Optional)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### 4. Seed Demo Data (Optional)
Populate the database with pre-configured events, clubs, registrations, and accounts:
```bash
node seed.js
```

### 5. Run the Application
Start the development server:
```bash
npm run dev
# or for standard production startup:
npm start
```
The server will bind to `http://localhost:3000`.

---

## 🔌 API Reference

### Authentication & Users (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new student or faculty account |
| `POST` | `/api/auth/login` | Public | Authenticate user & return JWT |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |
| `PUT` | `/api/auth/profile` | Authenticated | Update user contact details & interest tracks |
| `GET` | `/api/auth/users` | Principal / Admin | Search and list users with role filters |
| `PUT` | `/api/auth/users/:id/role` | Principal / Admin | Promote or modify user permissions |

### Clubs & Governance (`/api/clubs`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/clubs` | Public | List all active college clubs |
| `GET` | `/api/clubs/my` | Authenticated | Return clubs where user is FA or Officer |
| `POST` | `/api/clubs` | Principal / Admin | Create a new student club |
| `PUT` | `/api/clubs/:id` | Principal / Admin | Update club metadata or assign FA |
| `DELETE` | `/api/clubs/:id` | Principal / Admin | Remove club record |

### Club Officer Applications (`/api/officer-requests`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/officer-requests` | Student | Submit application for Club President / Secretary |
| `GET` | `/api/officer-requests/mine` | Student | Retrieve status of submitted applications |
| `GET` | `/api/officer-requests/pending` | FA / Admin | List pending officer applications for advised clubs |
| `PUT` | `/api/officer-requests/:id/approve` | FA / Admin | Approve officer application and assign role |
| `PUT` | `/api/officer-requests/:id/reject` | FA / Admin | Reject officer application with review note |

### Faculty Advisor Requests (`/api/fa-requests`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/fa-requests` | Faculty | Submit nomination to advise a club |
| `GET` | `/api/fa-requests` | Principal / Admin | List faculty advisor nominations |
| `PUT` | `/api/fa-requests/:id/approve` | Principal / Admin | Approve FA and link to club |
| `PUT` | `/api/fa-requests/:id/reject` | Principal / Admin | Reject FA application with review feedback |

### Proposals & Workflow (`/api/proposals`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/proposals` | Officer / FA / Admin | Submit new event proposal (`pending_fa`) |
| `GET` | `/api/proposals/my` | Authenticated | Track proposals submitted by current user |
| `GET` | `/api/proposals/pending` | Approver | Retrieve pending proposals matching user authority |
| `PUT` | `/api/proposals/:id/approve` | Approver | Advance proposal stage (FA -> Principal -> Live Event) |
| `PUT` | `/api/proposals/:id/reject` | Approver | Reject proposal with comments |

### Events & Discovery (`/api/events`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/events` | Public | Fetch published events with optional category/tag filters |
| `GET` | `/api/events/:id` | Public | Retrieve detailed event metadata |
| `POST` | `/api/events` | Admin | Directly create published event |
| `PUT` | `/api/events/:id` | Admin | Update event parameters |
| `DELETE` | `/api/events/:id` | Admin | Cascade delete event and registrations |

### Registrations & Waitlist (`/api/registrations`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/registrations` | Authenticated | Register for event (allocates seat or waitlist position) |
| `GET` | `/api/registrations/:eventId` | Authenticated | List registrations for event |
| `GET` | `/api/registrations/student/:email` | Authenticated | Retrieve student's registration records |
| `PUT` | `/api/registrations/:id/cancel` | Authenticated | Cancel registration & trigger automatic queue promotion |

### Ticketing & Gate Scanner (`/api/tickets`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/tickets/:id/qr.png` | Authenticated | Generate dynamic QR code PNG for ticket |
| `GET` | `/api/tickets/:id/pdf` | Authenticated | Generate and stream styled PDF e-ticket |
| `GET` | `/api/tickets/verify/:token` | Public | Gatekeeper verification endpoint for scanner |

### Artificial Intelligence (`/api/ai`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/ai/suggest-tags` | Authenticated | Gemini AI event tag suggestion & description enhancement |
| `POST` | `/api/ai/chat` | Authenticated | EventBot natural language query engine |

---

## 📜 Academic Attribution

Developed for **Web Programming Lab (Experiment 11)**  
Department of Computer Science and Engineering (Data Science)  
**Mar Athanasius College of Engineering (MACE), Kothamangalam**
