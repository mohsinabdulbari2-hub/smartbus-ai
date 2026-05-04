SmartBus AI

SmartBus AI is a mini-project focused on improving how bus tracking systems work using simple logic and structured data.
The idea behind this project is to simulate how buses move on routes and provide approximate arrival timings.

This project was built as part of an academic mini-project to explore real-world transport problems and how software can help solve them.


What this project does

In many cities, bus timings are not reliable and passengers don’t know when the bus will arrive.
This project tries to solve that by:

- Simulating bus movement along routes
- Tracking the current position of buses
- Estimating arrival time at upcoming stops
- Managing route, stop, and shape data

The system does not depend on live GPS but works on predefined data and logic.

How it works (simple explanation)

- Bus routes and stops are stored as structured data
- Each bus moves step-by-step along its route
- If the bus is near a stop, it pauses for a few seconds
- Distance between points is used to update movement
- Based on this, estimated arrival time is calculated

This is more of a simulation model than a real-time production system.

Project Structure

smartbus-ai/
│
├── lib/                  # Core logic and data handling
├── scripts/              # Utility scripts (data processing, setup)
├── artifacts/            # Generated or processed outputs
├── attached_assets/      # Supporting files
│
├── package.json
├── tsconfig.json
├── replit.nix
└── README.md

Technologies Used

- Node.js
- TypeScript
- pnpm
- JSON datasets

How to run

git clone https://github.com/mohsinabdulbari2-hub/smartbus-ai.git
cd smartbus-ai
pnpm install
pnpm start

Notes

- This project uses static data (no live GPS)
- It is mainly for learning and demonstration purposes
- Some large files (zip datasets) are included for testing

Limitations

- No real-time tracking
- No frontend interface (if not added yet)
- Predictions are basic and not AI-based

Future improvements

- Add real-time GPS integration
- Improve arrival prediction using better algorithms
- Build a simple frontend dashboard
- Optimize data handling
GitHub: https://github.com/mohsinabdulbari2-hub

---
