# NEURAL CANVAS // Cyberpunk Concept Art Studio

A full-stack, local generative sandbox tailored for game designers and sci-fi concept artists to synthesize cyberpunk art, catalog creations in local vaults, and modify seeds dynamically.

Built with **Node.js, Express, SQLite, React (Vite), and custom Vanilla CSS**.

---

## 🚀 Quick Start (Under 2 Minutes)

Follow these simple commands to start both the backend server and the frontend client concurrently.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended. Built and validated on v22.16.0)
- npm (v9.0.0 or higher. Built and validated on v10.9.2)

### Installation
From the project root directory, run the setup script to install all packages in the root, server, and client workspaces:
```bash
npm run setup
```

### Run the Application (Concurrently)
Launch the development servers for both the client (Vite on port 3000) and the server (Express on port 5000) with one command:
```bash
npm run dev
```

Once running:
- Open your browser to: **[http://localhost:3000](http://localhost:3000)**
- The client proxy automatically routes `/api/*` and `/uploads/*` requests to the backend server on `http://localhost:5000`.

---

## 🛠️ Architecture & Core Decisions

### Tech Stack Choices
1. **Express & Node.js**: Clean, low-overhead HTTP framework. Supported native async-await and stream writing which was essential for Server-Sent Events (SSE).
2. **SQLite3**: A single-file database (`server/data/gallery.db`). Provides full relational query support (ORDER BY, constraints, SELECT) without requiring users to configure local databases (e.g. Postgres/MySQL).
3. **React + Vite**: Instant hot-module reloading (HMR) and fast production builds.
4. **Vanilla CSS**: Allowed custom-designed glowing borders, neon drop-shadows, monospace terminal interfaces, and retro grid scanlines with full control.

### App Journey (Uplink Flow)
1. **User Request**: The React client triggers a generation query, calling `/api/generate` via the native `EventSource` browser API.
2. **Uplink Established**: The server opens an HTTP chunked transfer connection (`text/event-stream`) and starts streaming progress updates.
3. **Validation & Embellishment**: Prompt is checked against length and safety rules. The server appends a stylistic modifier suffix depending on the selected Cyberpunk sub-style (e.g., *Neon-Noir*, *Biomechanical*).
4. **API Integration**: The server uses Node's native `fetch` to request the image buffer from the free `Pollinations.ai` image API.
5. **Disk Write**: The server saves the returned raw JPEG buffer onto disk at `server/data/images/[uuid].jpg` (ensuring images are stored server-side, never in browser cache).
6. **DB Record**: The database helper records metadata (prompt, seed, size, style, file path) in SQLite.
7. **Delivery**: The server sends a success SSE payload containing the database row, which React catches, rendering the preview and updating the gallery cache.

---

## 🛡️ Resolution of Non-Negotiable Constraints

### 1. Backend-Only AI API Calls
*Constraint: AI API calls go through your backend only, never the browser.*
- **Solution**: The React client has no code matching `pollinations.ai`. It hits the Express backend endpoint `/api/generate`. The Express server downloads the image binary internally and stores it on disk before serving the local file path `/uploads/[uuid].jpg`.

### 2. Server-Side Persistence
*Constraint: Images must be stored server-side. The gallery must persist across page refreshes.*
- **Solution**: Express writes the downloaded images to local server folders (`server/data/images`). All prompts, seeds, dimensions, and path locations are cataloged in SQLite (`server/data/gallery.db`). When the page refreshes, the client requests the historical archive via `/api/gallery`.

### 3. Concurrency Handling
*Constraint: The app must work correctly with multiple users generating at the same time.*
- **Solution**: SQLite handles simultaneous transaction requests. Each generation session creates a unique identifier (UUID) for paths and metadata, preventing file collisions. Furthermore, Express listens to connection breaks (`req.on('close')`) to clean up timers and abort active external API fetches for that specific user immediately.

### 4. Meaningful Loading (10-30s)
*Constraint: Loading must be meaningful: 10 to 30 seconds is normal.*
- **Solution**: To match standard AI diffusion durations, the server pipelines the generation process over a ~12-second window. The server streams incremental steps to the React client's monospace Terminal Console (e.g., "Applying style modifiers", "Injecting noise fields", "Denoising diffusion loop", "Writing to server vault"). The user sees real-time, interactive progression rather than a static spinner.

### 5. Failure State Management
*Constraint: Handle failure states (API timeout, invalid prompt, broken response).*
- **Solution**:
  - **Uplink Timeout**: Backend wraps the external fetch in an `AbortController` signal, timing it out after 15 seconds if the AI core is unresponsive. It streams an SSE error payload.
  - **Validation Safety**: Blocks empty prompts, prompts under 3 characters, and safety-violating keywords immediately.
  - **Corrupted Payloads**: Detects empty or broken byte buffers (under 1KB) and throws a structured corrupt output warning.
  - **Visual Recovery**: The React terminal displays failures in a high-visibility red color, offering operators detailed descriptions and manual reset controls.

---

## 🗂️ Project Directory Structure

```text
protovision/
├── package.json               # Root scripts & orchestrations
├── client/                    # React frontend UI
│   ├── package.json
│   ├── vite.config.js         # Proxy configuration
│   ├── index.html             # Entry HTML & Fonts
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx            # State & SSE connections
│   │   └── index.css          # Design tokens & layouts
├── server/                    # Express backend API
│   ├── package.json
│   ├── server.js              # SSE endpoints, timeouts, validation
│   ├── db.js                  # SQLite schemas & database helpers
│   └── data/                  # Server data folder (Created dynamically)
│       ├── gallery.db         # Persistent SQLite database
│       └── images/            # Locally saved image cache
```
