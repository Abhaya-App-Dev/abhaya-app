# Abhaya (WomenSafe) App

Abhaya is a professional, high-fidelity personal safety application designed to provide immediate tracking, alerts, and emergency assistance to women in India. The application features a centralized Command Center, automated SOS countdown triggers, real-time location mapping, audio/video proof recording, and rapid dispatch notification to a trusted circle.

---

## 🌟 Key Features

### 1. Central SOS Command Center
* **Animated SOS Trigger**: A large, pulsing central SOS console button that initiates immediate emergency protocols.
* **3-Second Countdown Overlay**: A fullscreen interactive countdown that alerts the user and provides a "Cancel" button to abort accidental triggers before dispatch.
* **Safety Zone Status**: Calculates your safety level (Green, Orange, or Red zone) based on real-time distances to nearest verified shelters (police stations, hospitals, and government offices).

### 2. Live Tracking & Safe Zones Map
* **Google Maps Integration**: Displays your live position and maps nearby safe places.
* **Safe Shelter Navigation**: Lists the top 8 nearest safe zones sorted by distance with rating and one-click Google Maps route guidance.
* **Dynamic Search Radius**: Automatically expands search up to 50km if no close shelters are found.

### 3. Quick Emergency Media Recording
* **Audio & Video Proof**: Capture 15-30 second recordings directly inside the browser.
* **Supabase Storage Upload**: Audio/video proof uploads instantly to secure public storage.
* **Alert Delivery**: Automatically generates a public preview URL and emails/texts it to your trusted circle.

### 4. Trusted Circle & Broadcast Messaging
* **Circle Management**: Add, view, and manage up to 7 primary emergency contacts.
* **Broadcast Alerts**: Send customized alert subjects and messages with your live location coordinates to all contacts simultaneously.
* **Individual Chat**: Quick-message specific contacts during less critical events.

### 5. Helpline Quick Dials
* Verified quick-call hotkeys for Indian national emergency numbers:
  * 🚔 **Police / Control Room**: 100
  * 👩‍⚕️ **Women Helpline**: 1091
  * 🚑 **Ambulance**: 108
  * 🛡️ **Domestic Distress**: 181

---

## 🛠️ Technology Stack

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI primitives).
* **Maps API**: Google Maps JavaScript API & Places Service API.
* **Backend Database**: Supabase (PostgreSQL with RLS, Triggers, and Functions).
* **Alert Delivery**: Supabase Edge Functions & Resend Email Delivery SDK.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Supabase CLI](https://supabase.com/docs/guides/cli) (installed via npm or globally)

### Installation
1. Clone the repository and navigate into the project directory:
   ```bash
   cd abhaya-app
   ```
2. Install the node dependencies:
   ```bash
   npm install
   ```

### Configuration
1. Create a `.env` file in the root directory (based on `.env.example`):
   ```env
   # Supabase Project Credentials
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>

   # Google Maps
   VITE_GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>

   # Resend Secret
   RESEND_API_KEY=<your-resend-api-key>
   ```

2. Set up your **Supabase Storage Bucket**:
   * Go to **Storage** in your Supabase Dashboard.
   * Create a new bucket named **`emergency-media`**.
   * Toggle **Public** to **ON** (required for emergency contacts to access files).

---

## 📦 Backend Setup and Deploy

Run the automated PowerShell deployment script to link your Supabase account, deploy the SQL database schemas, set up Row Level Security, upload Edge Functions, and set environment secrets:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup_supabase.ps1
```

*Note: You will need your Supabase Database Password and a [Personal Access Token](https://supabase.com/dashboard/account/tokens) to run the CLI script.*

---

## 🖥️ Running Locally

Start the Vite hot-reloading development server:

```bash
npm run dev
```

Navigate to `http://localhost:5173` to test the application.

---

## 📄 License
This project is open-source and free to adapt. Protect and stay safe!
