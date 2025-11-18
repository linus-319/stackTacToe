import eventlet
eventlet.monkey_patch()

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import uuid
from dotenv import load_dotenv
from models import Game

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')

allowed_origins = [os.getenv('CORS_ALLOWED_ORIGIN')]

CORS(app, supports_credentials=True, origins=allowed_origins)

socketio = SocketIO(
    app,
    cors_allowed_origins=allowed_origins,
    allow_credentials=True,
    async_mode='eventlet',
)

games = {}
short_code_mapping = {}
player_sessions = {}

def serialize_game(game):
    return {
        "board": game.board,
        "current_player": game.current_player,
        "winner": game.winner,
        "status": game.status,
        "win_positions": game.win_positions
    }


@app.route('/api/game/new', methods=['POST'])
def new_game():
    game_type = request.json.get("mode")

    if not game_type or game_type not in ['single', 'double']:
        return jsonify({"error": "Invalid game type."}), 404

    game = Game()

    sid = request.sid if hasattr(request, 'sid') else None 
    if game_type == 'single':
        game.player_x = sid or request.remote_addr 
        game.player_o = 'robot'
        game.player_types = {'X': 'human', 'O': 'robot'}
    elif game_type == 'double':
        game.player_x = sid or request.remote_addr 
        game.player_types = {'X': 'human', 'O': 'human'}
        game.status = 'waiting'

    game_id = str(uuid.uuid4())
    games[game_id] = game

    short_code = str(int(game_id.replace('-', ''), 16) % 10 ** 6)
    short_code_mapping[short_code] = game_id

    return jsonify({"gameId": game_id, "joinCode": short_code})


@app.route('/api/game/join', methods=['POST'])
def join_game():
    short_code = request.json.get("code")
    game_id = short_code_mapping.get(short_code)

    if not game_id or game_id not in games:
        return jsonify({"error": "Invalid game code"}), 404

    game = games[game_id]
    sid = request.sid if hasattr(request, 'sid') else None

    if game.player_o is None:
        game.player_o = request.remote_addr
        game.status = 'active'
        socketio.emit('game_update', serialize_game(game), room=game_id)
    else:
        return jsonify({"error": "Game already full"}), 400

    return jsonify({"gameId": game_id})


@app.route('/api/game/<game_id>/move', methods=['POST'])
def player_move(game_id):
    game = games.get(game_id)
    if not game:
        return jsonify({"error": "Game not found"}), 404
    
    sid = request.sid if hasattr(request, 'sid') else None
    current = game.current_player
    player_id = sid or request.remote_addr

    if game.player_types[current] == 'human' and player_id not in [game.player_x, game.player_o]:
        return jsonify({"error": "Not your turn."}), 403

    data = request.get_json()
    x, y, z = data.get("x"), data.get("y"), data.get("z")

    if x is None or y is None or z is None:
        return jsonify({"error": "Missing coordinates"}), 400

    success = game.make_move(x, y, z)
    if not success:
        return jsonify({"error": "Invalid move"}), 400

    if not game.winner and game.player_types['O'] != 'human':
        game.robot_move()

    socketio.emit('game_update', serialize_game(game), room=game_id)
    return jsonify({ "success": True })


@app.route('/api/game/<game_id>/state', methods=['GET'])
def get_game_state(game_id):
    game = games.get(game_id)
    if not game:
        return jsonify({"error": "Game not found"}), 404
    return jsonify(serialize_game(game))


@socketio.on('join')
def on_join(data):
    game_id = data['gameId']
    sid = request.sid
    join_room(game_id)

    game = games.get(game_id)
    if not game:
        return

    if game.player_x == sid or game.player_o == sid:
        player_sessions[sid] = (game_id, 'X' if game.player_x == sid else 'O')

    if game.player_x and game.player_o and game.status == 'waiting':
        game.status = 'active'
    
    emit('game_update', serialize_game(games[game_id]), room=game_id)


@socketio.on('leave')
def on_leave(data):
    sid = request.sid
    game_id = data['gameId']
    game = games.get(game_id)

    if not game:
        leave_room(game_id)
        return
    
    if game.player_x == sid:
        game.player_x = None
    elif game.player_o == sid:
        game.player_o = None

    player_sessions.pop(sid, None)

    if not game.player_x and not game.player_o:
        games.pop(game_id, None)
        for k, v in list(short_code_mapping.items()):
            if v == game_id:
                short_code_mapping.pop(k, None)
        leave_room(game_id)
        return
    
    game.status = 'waiting' if game.player_x or game.player_o else 'ended'
    emit('player_left', {'status': game.status}, room=game_id)
    leave_room(game_id)


@socketio.on('new_game')
def on_new_game(data):
    old_game_id = data['oldGameId']
    new_game_id = data['newGameId']
    emit('switch_game', {'gameId': new_game_id}, room=old_game_id)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    if sid not in player_sessions:
        return
    
    game_id, role = player_sessions.pop(sid)
    game = games.get(game_id)
    if not game:
        return

    if role == 'X':
        game.player_x = None
    elif role == 'O':
        game.player_o = None

    if not game.player_x and not game.player_o:
        games.pop(game_id, None)
        for k, v in list(short_code_mapping.items()):
            if v == game_id:
                short_code_mapping.pop(k, None)
        return

    game.status = 'waiting'
    emit('player_left', {'status': game.status}, room=game_id)


if __name__ == '__main__':
    import eventlet.wsgi
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
