import { useEffect, useState } from "react";
import axios from "axios";
import { useSocketEvent } from "../utils/useSocketEvent";

const API_BASE = `${process.env.REACT_APP_API_URL}/api`;

export function useGame(socket, setScreen, mode, setMode) {
  const [loading, setLoading] = useState(false);
  const [gameState, setGameState] = useState({
    board: null,
    currentPlayer: null,
    winner: null,
    joinCode: "",
    gameId: null,
    gameStatus: null,
    mySymbol: null,
    winPositions: null,
  });

  const { board, currentPlayer, winner, joinCode, gameId, gameStatus, mySymbol, winPositions } = gameState;

  const setBoard = (board) => setGameState((prev) => ({ ...prev, board }));
  const setCurrentPlayer = (currentPlayer) => setGameState((prev) => ({ ...prev, currentPlayer }));
  const setWinner = (winner) => setGameState((prev) => ({ ...prev, winner }));
  const setJoinCode = (joinCode) => setGameState((prev) => ({ ...prev, joinCode }));
  const setGameId = (gameId) => setGameState((prev) => ({ ...prev, gameId }));
  const setGameStatus = (gameStatus) => setGameState((prev) => ({ ...prev, gameStatus }));
  const setMySymbol = (mySymbol) => setGameState((prev) => ({ ...prev, mySymbol }));
  const setWinPositions = (winPositions) => setGameState((prev) => ({ ...prev, winPositions }));

  const resetGameState = () => {
    setGameState({
      board: null,
      currentPlayer: null,
      winner: null,
      joinCode: null,
      gameId: null,
      gameStatus: null,
      mySymbol: null,
      winPositions: null,
    });
  };

  const updateGameFromSocket = (data) => {
    setGameState((prev) => ({
      ...prev,
      board: data.board,
      currentPlayer: data.current_player,
      winner: data.winner,
      gameStatus: data.status,
      winPositions: data.win_positions,
    }));
  };

  const fetchGameState = async (id) => {
    const res = await axios.get(`${API_BASE}/game/${id}/state`);
    setBoard(res.data.board);
    setCurrentPlayer(res.data.current_player);
    setWinner(res.data.winner);
    setWinPositions(res.data.win_positions);
  };

  const startSinglePlayerGame = async () => {
    try {
      const res = await axios.post(`${API_BASE}/game/new`, { mode: "single" });
      setGameId(res.data.gameId);
      await fetchGameState(res.data.gameId);
      setMode("single");
      setMySymbol("X");
      setScreen("in-game");
    } catch (err) {
      console.error(err);
    }
  };

  const createMultiplayerGame = async () => {
    try {
      const res = await axios.post(`${API_BASE}/game/new`, { mode: "double" });
      setGameId(res.data.gameId);
      setJoinCode(res.data.joinCode);
      setMode("double");
      setGameStatus("waiting");
      setMySymbol("X");
      setScreen("in-game");
    } catch (err) {
      console.error(err);
    }
  };

  const joinMultiplayerGame = async () => {
    try {
      const res = await axios.post(`${API_BASE}/game/join`, { code: joinCode });
      setGameId(res.data.gameId);
      setMode("double");
      setGameStatus("active");
      setMySymbol("O");
      setScreen("in-game");
      socket.emit("join", { gameId: res.data.gameId });
    } catch (err) {
      console.error(err);
    }
  };

  const makeMove = async (x, y, z) => {
    if (!gameId || winner) return;

    if (mode === "single" && currentPlayer !== "X") return;
    if (mode === "double" && currentPlayer !== mySymbol) return;

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/game/${gameId}/move`, { x, y, z });
      await fetchGameState(gameId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const newGame = async () => {
    if (!gameId) return;

    try {
      const res = await axios.post(`${API_BASE}/game/new`, { mode });
      const newId = res.data.gameId;

      socket.emit("new_game", { oldGameId: gameId, newGameId: newId });

      setGameId(newId);
      await fetchGameState(newId);
      setWinner(null);
    } catch (err) {
      console.error(err);
    }
  };

  const backHome = () => {
    if (mode === "double" && gameId) {
      socket.emit("leave", { gameId });
    }
    resetGameState();
    setMode(null);
    setScreen("home");
  };

  useSocketEvent(socket, "game_update", updateGameFromSocket);

  useSocketEvent(socket, "switch_game", async ({ gameId }) => {
    setGameId(gameId);
    await fetchGameState(gameId);
    setWinner(null);
    setWinPositions(null);
  });

  useSocketEvent(socket, "player_left", () => {
    alert("Opponent left the game.");
    resetGameState();
    setMode(null);
    setScreen("home");
  });

  useEffect(() => {
    const handleUnload = () => {
      if (mode === "double" && gameId) {
        socket.emit("leave", { gameId });
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [socket, mode, gameId]);

  useEffect(() => {
    if (!gameId) return;

    const joinRoom = () => {
      socket.emit("join", { gameId });
    };

    if (socket.connected) joinRoom();
    else socket.once("connect", joinRoom);

    return () => {
      socket.off("connect", joinRoom);
    };
  }, [socket, gameId]);

  return {
    board,
    currentPlayer,
    winner,
    joinCode,
    gameId,
    gameStatus,
    mySymbol,
    winPositions,
    loading,
    setJoinCode,
    startSinglePlayerGame,
    createMultiplayerGame,
    joinMultiplayerGame,
    makeMove,
    newGame,
    backHome,
  };
}
