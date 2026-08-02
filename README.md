# MACE FestHub — Campus Event Registration System

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)](https://www.mongodb.com/cloud/atlas)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A full-stack, responsive Campus Event Registration System built for **Lab Experiment 11** of the **B.Tech CSE (Data Science)** curriculum at **Mar Athanasius College of Engineering (MACE)**.

---

## 🌟 Key Features

- **Dynamic Event Discovery**: Browse campus events by categories (`Technical`, `Cultural`, `Sports`, `Workshop`) with real-time available seat counters.
- **State-Driven Capacity Engine**: Real-time capacity enforcement. When an event is full, student registrations are queued into a **Waitlist**.
- **Automatic Waitlist Promotion**: When a confirmed registration is cancelled, the server **automatically promotes** the `#1` waitlisted student to `confirmed` and shifts all remaining waitlist positions down atomically via `$inc`.
- **Double-Booking Prevention**: Database-level compound unique index `{ eventId, email }` prevents duplicate registrations.
- **Admin Dashboard**: Full CRUD management for events, real-time registration tables, per-event seat counters, and cancellation controls with instant feedback toasts.
- **Modern Glassmorphism UI**: Responsive dark theme built with CSS variables, micro-animations, animated canvas/orbs, and accessible ARIA attributes.
- **E-Ticket & Digital Pass Generator**: Automatic generation of printable passes with unique ticket codes and QR code badges upon confirmed registration.
- **Interactive Calendar & Schedule View**: Toggle between Grid view and Calendar/Timeline view for campus schedule planning.

---

## 📊 Feature Hierarchy & Implementation Depth

The project follows a structured 10-tier feature roadmap balancing syllabus requirements, architectural depth, and practical lab feasibility:

| Tier | Feature Name | Implementation Depth | Status |
|:---:|---|---|:---:|
| **Step 1** | **Event Listing Page** | `GET /api/events` endpoint, dynamic category filtering (`Technical`, `Cultural`, `Sports`, `Workshop`) | ✅ Implemented |
| **Step 2** | **Event Creation** | `POST /api/events` endpoint with admin modal form & schema validation | ✅ Implemented |
| **Step 3** | **Registration Form** | Client-side validation (email format, required fields) & `POST /api/registrations` | ✅ Implemented |
| **Step 4** | **Cancellation Handling** | `PUT /api/registrations/:id/cancel` state transition logic | ✅ Implemented |
| **Step 5** | **Admin Dashboard** | Real-time attendee aggregation, capacity meters, and per-event tables | ✅ Implemented |
| **Step 6** | **Capacity Limits** | Real-time seat enforcement (`confirmedCount < capacity`) preventing overbooking | ✅ Implemented |
| **Step 7** | **Waitlist Auto-Promotion** | Auto-queue on full capacity; automated promotion of `#1` waitlisted student on cancellation via `$inc` | ✅ Implemented |
| **Step 8** | **Schedule / Calendar View** | Interactive timeline & date-grouped schedule view | ✅ Implemented |
| **Step 9** | **Digital E-Ticket Booking** | Unique Pass Ticket ID generation, QR code badge, and printable digital pass | ✅ Implemented |
| **Step 10** | **Extra Enhancements** | Scope-managed extensions (Toast notifications, compound unique DB constraints) | ✅ Implemented |

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla CSS3 (Custom Design Tokens), JavaScript (Fetch API) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas (Cloud NoSQL Document Store) via Mongoose ODM |
| **Environment** | dotenv, cors, nodemon |

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas database cluster (or local MongoDB server)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/miyan-jawhar/mace-festhub.git
   cd mace-festhub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (or copy `.env.example`):
   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/mace_festhub?retryWrites=true&w=majority
   PORT=3000
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```

5. **Open in Browser:**
   - **Student Portal:** `http://localhost:3000/`
   - **Admin Dashboard:** `http://localhost:3000/admin.html`

---

## 📡 REST API Reference

### Events API (`/api/events`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/events` | List all events (sorted by date) |
| `GET` | `/api/events/:id` | Get details of a single event |
| `POST` | `/api/events` | Create a new event |
| `PUT` | `/api/events/:id` | Update event details |
| `DELETE` | `/api/events/:id` | Delete event and cascade-delete its registrations |

### Registrations API (`/api/registrations`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/registrations` | Register student (assigns `confirmed` or `waitlisted`) |
| `GET` | `/api/registrations/:eventId` | Get all active registrations for an event |
| `PUT` | `/api/registrations/:id/cancel` | Cancel registration & auto-promote next waitlisted student |
| `DELETE` | `/api/registrations/:id` | Hard-delete registration (Admin) |

---

## 📁 Repository Structure

```
.
├── server.js                 # Express server & MongoDB Atlas connection
├── .env.example              # Environment template
├── package.json              # Project dependencies & scripts
├── models/
│   ├── Event.js              # Event schema with atomic counters
│   └── Registration.js       # Registration schema with unique index
├── controllers/
│   ├── eventController.js        # Event CRUD logic
│   └── registrationController.js # Registration & waitlist state engine
├── routes/
│   ├── events.js             # Event router
│   └── registrations.js      # Registration router
└── public/
    ├── index.html            # Student portal
    ├── admin.html            # Admin dashboard
    ├── css/style.css         # Custom Glassmorphism UI stylesheet
    └── js/
        ├── events.js         # Student UI controller
        └── admin.js          # Admin UI controller
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
