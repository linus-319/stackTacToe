import { useEffect, useState } from 'react';
import { useGame } from './utils/useGame';
import { io } from 'socket.io-client';
import HomeScreen from './components/HomeScreen';
import MultiplayerMenu from './components/MultiplayerMenu';
import GameScreen from './components/GameScreen';
import './index.css';

const socket = io(window.location.origin, { // for development change window.location.origin to REACT_APP_API_URL (defined in frontend/.env)
  transports: ['websocket'],
  withCredentials: true,
});

function App() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState(null);
  const game = useGame(socket, setScreen, mode, setMode);

  useEffect(() => {
    let title = "ThicTacToe";
    if (screen === "in-game") {
      if (game.winner) {
        title = `${game.winner === 'X' ? 'Red' : 'Blue'} wins! | ThicTacToe`;
      } else if (mode === 'double') {
        title = `Multiplayer | ThicTacToe`;
      } else if (mode === 'single') {
        title = `Single Player | ThicTacToe`;
      }
    }
    document.title = title;
  }, [screen, game.winner, mode]);

  if (screen === "home") {
    return (
      <HomeScreen
        startSinglePlayerGame={game.startSinglePlayerGame}
        setScreen={setScreen}
      />
    );
  }

  if (screen === "multiplayer-menu") {
    return (
      <MultiplayerMenu
        createMultiplayerGame={game.createMultiplayerGame}
        joinCode={game.joinCode}
        setJoinCode={game.setJoinCode}
        joinMultiplayerGame={game.joinMultiplayerGame}
        backHome={game.backHome}
      />
    )
  }

  if (screen === "in-game") {
    return (
      <GameScreen {...game} mode={mode} />
    );
  }

  return null;
}

export default App;
