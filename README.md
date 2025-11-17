# ThicTacToe
A 3D Tic Tac Toe game with real-time multiplayer support, built with Flask, React, and Three.js.

## Features
- Multiplayer Mode: Create/join games with short codes.
- Single Player Mode: Play against a simple robot.
- 3D Game Board: Interactive 3D grid using Three.js.
- Real-Time Updates: WebSocket communication with Flack-SocketIO.
- REST API for game creation, joining, and moves.

## Tech Stack
### Frontend
- React
- Three.js
- Jest

### Backend
- Python + Flask
- Flask SocketIO

## Getting Started
Prerequisites:
- Node.js
- Python3
- pip

Local Setup:
1. Clone the repository
`git clone https://github.com/Linus319/stackTacToe.git`
2. Backend Setup (Flask)
```
cd stackTacToe/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
3. Frontend Setup (React)
```
cd stackTacToe/fontend
npm run start
```

### Alternative Docker Setup:
```
cd stackTacToe
docker compose up -d
```

## API Endpoints
- Create Game: `POST /api/game/new → { gameId, joinCode }`
- Join Game: `POST /api/game/join with { code }`
- Make Move: `POST /api/game/<gameId>/move with { x, y, z }`
- Get Game State: `GET /api/game/<gameId>/state`

## Future Improvements
- Redis for persistend storage.
- Smarter AI for single-player mode.

## Author
- Thomas Fagan - [GitHub](https://github.com/Linus319)