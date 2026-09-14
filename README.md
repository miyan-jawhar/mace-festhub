# MACE FestHub — Campus Event Registration System

> **Web Programming Lab — Experiment 11**  
> B.Tech Computer Science and Engineering (Data Science)  
> Mar Athanasius College of Engineering (MACE)

A full-stack web application built with **Node.js, Express, and MongoDB Atlas** featuring dynamic capacity enforcement, automated waitlist queue management, auto-promotion state transitions, and a clean minimalist user interface.

---

## 🚀 Key Engineering Features

- **Atomic Capacity Tracking:** Utilizes MongoDB `$inc` operators to manage seat availability without race conditions.
- **Automated Waitlist Promotion:** When a confirmed attendee cancels their registration, the first waitlisted student (position 1) is automatically promoted to `confirmed` status, and remaining waitlist queue positions shift down atomically.
- **Double-Booking Prevention:** Enforces database-level uniqueness via compound indexes `(eventId, email)` in Mongoose.
- **Student Self-Cancel Lookup:** Dedicated lookup interface allowing students to view active registrations by email and self-cancel with live waitlist promotion notifications.
- **Admin Management Panel:** Full event CRUD suite, aggregate capacity analytics dashboard, and per-event registration management.

---

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (Cloud) with Mongoose ODM
- **Frontend:** Vanilla HTML5, Modern CSS (Custom Design System with Inter typography), JavaScript (Fetch API)
- **Environment:** dotenv, CORS

---

## 📁 Project Structure

```
Web Programming/
├── controllers/
│   ├── eventController.js         # Event CRUD & cascade deletion
│   └── registrationController.js  # Registration, waitlist & auto-promotion logic
├── models/
│   ├── Event.js                   # Mongoose Event schema with denormalized counts
│   └── Registration.js            # Mongoose Registration schema with compound index
├── public/
│   ├── css/
│   │   └── style.css              # Custom minimalist dark theme design system
│   ├── js/
│   │   ├── admin.js               # Admin dashboard client-side logic
│   │   └── events.js              # Student portal client-side logic & lookup
│   ├── admin.html                 # Admin portal dashboard interface
│   └── index.html                 # Student-facing events & registration portal
├── routes/
│   ├── events.js                  # REST API endpoints for events
│   └── registrations.js           # REST API endpoints for registrations
├── .env.example                   # Environment configuration template
├── package.json                   # Project dependencies & scripts
└── server.js                      # Express server entry point & MongoDB Atlas connection
```

---

## ⚡ Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB Atlas Account & Connection String

### Setup Instructions

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
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=your_mongodb_atlas_connection_string
   PORT=3000
   ```

4. **Run the server:**
   ```bash
   npm run dev
   # or
   npm start
   ```

5. **Access the Application:**
   - **Student Portal:** `http://localhost:3000`
   - **Admin Dashboard:** `http://localhost:3000/admin.html`

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/events` | Fetch all upcoming & active events |
| `GET` | `/api/events/:id` | Fetch single event details |
| `POST` | `/api/events` | Create a new event (Admin) |
| `PUT` | `/api/events/:id` | Update event details (Admin) |
| `DELETE` | `/api/events/:id` | Cascade delete event and associated registrations |
| `POST` | `/api/registrations` | Register student (Assigns `confirmed` or `waitlisted`) |
| `GET` | `/api/registrations/:eventId` | Fetch all registrations for a specific event |
| `GET` | `/api/registrations/student/:email` | Lookup active registrations by student email |
| `PUT` | `/api/registrations/:id/cancel` | Cancel registration & trigger automatic waitlist promotion |
| `DELETE` | `/api/registrations/:id` | Hard delete registration record |

---

## 📜 License

Developed for academic submission for Web Programming Lab (Experiment 11) at Mar Athanasius College of Engineering.
