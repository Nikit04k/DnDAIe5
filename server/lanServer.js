const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const os = require('os');

const PORT = parseInt(process.env.LAN_PORT || '3001', 10);
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ status: 'ok', server: 'DnDAIe5 Standalone LAN WS Server', port: PORT }));
});

const wss = new WebSocketServer({ server });

const roomState = {
  isHost: true,
  connected: true,
  hostAddress: '0.0.0.0',
  roomName: 'DnD 5e LAN Party',
  players: [],
  currentLocation: 'Вход в Пустоши',
  inGameDay: 1,
  inGameMinutes: 480,
  inGameTime: 'День 1 • 08:00',
  pendingRoll: null,
  isDmThinking: false,
  history: [],
  partyCompanions: [],
};

const connectedClients = new Map();

function broadcast(message, excludeWs = null) {
  const payload = JSON.stringify(message);
  for (const [id, client] of connectedClients.entries()) {
    if (client.ws.readyState === WebSocket.OPEN && client.ws !== excludeWs) {
      try {
        client.ws.send(payload);
      } catch (err) {
        console.error(`[Standalone WS Broadcast Error to ${id}]:`, err);
      }
    }
  }
}

function sendTo(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('[Standalone WS Send Error]:', err);
    }
  }
}

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (!list) continue;
    for (const iface of list) {
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

wss.on('connection', (ws) => {
  const clientId = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  connectedClients.set(clientId, { ws, player: null });

  sendTo(ws, {
    type: 'ROOM_STATE',
    state: {
      ...roomState,
      isHost: roomState.players.length === 0,
    },
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const clientData = connectedClients.get(clientId);

      switch (msg.type) {
        case 'JOIN_ROOM': {
          const playerPayload = msg.player;
          const newPlayer = {
            id: playerPayload.id || clientId,
            name: playerPayload.name || playerPayload.character?.name || 'Герой',
            character: playerPayload.character,
            isHost: Boolean(playerPayload.isHost),
            connectedAt: Date.now(),
            color: playerPayload.color || '#f59e0b',
            isReady: true,
          };

          if (clientData) {
            clientData.player = newPlayer;
          }

          const existingIdx = roomState.players.findIndex((p) => p.id === newPlayer.id || p.name === newPlayer.name);
          if (existingIdx >= 0) {
            roomState.players[existingIdx] = newPlayer;
          } else {
            roomState.players.push(newPlayer);
          }

          broadcast({ type: 'PLAYER_JOINED', player: newPlayer });
          broadcast({ type: 'ROOM_STATE', state: roomState });
          break;
        }

        case 'UPDATE_CHARACTER': {
          if (clientData && clientData.player) {
            clientData.player.character = msg.character;
            const idx = roomState.players.findIndex((p) => p.id === clientData.player.id);
            if (idx >= 0) roomState.players[idx].character = msg.character;
            broadcast({ type: 'PLAYER_UPDATED', player: clientData.player });
          }
          break;
        }

        case 'SEND_ACTION': {
          const charName = msg.characterName || clientData?.player?.name || 'Герой';
          const charClass = msg.playerClass || clientData?.player?.character?.class || '';
          const charRace = msg.playerRace || clientData?.player?.character?.race || '';
          const senderId = msg.characterId || clientData?.player?.id || clientId;
          const senderColor = msg.playerColor || clientData?.player?.color || '#38bdf8';

          const actionMsg = {
            id: 'msg_act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            role: 'user',
            text: msg.actionText,
            timestamp: Date.now(),
            gameTime: roomState.inGameTime,
            senderId: senderId,
            senderName: charName,
            senderCharacterName: charName,
            senderClass: charClass,
            senderRace: charRace,
            senderColor: senderColor,
          };

          roomState.history.push(actionMsg);
          roomState.roundActions = roomState.roundActions || {};
          roomState.roundActions[senderId] = {
            playerId: senderId,
            characterName: charName,
            playerClass: charClass,
            playerRace: charRace,
            playerColor: senderColor,
            actionText: msg.actionText,
            timestamp: Date.now(),
          };

          broadcast({ type: 'CHAT_MESSAGE', message: actionMsg });
          broadcast({ type: 'ROUND_STATE_UPDATE', roundActions: roomState.roundActions });
          break;
        }

        case 'FORCE_DM_TURN': {
          broadcast({ type: 'FORCE_DM_TURN' });
          break;
        }

        case 'SUBMIT_ROLL': {
          const roll = msg.rollResult;
          const rollReq = msg.rollReq;
          const charName = roll.characterName || clientData?.player?.name || 'Герой';
          const charClass = clientData?.player?.character?.class || '';
          const modStr = roll.modifier >= 0 ? `+${roll.modifier}` : `${roll.modifier}`;

          let outcomeText = '';
          if (roll.isCrit) outcomeText = ' 🌟 КРИТИЧЕСКИЙ УСПЕХ (Nat 20)!';
          else if (roll.isFumble) outcomeText = ' 💀 КРИТИЧЕСКИЙ ПРОВАЛ (Nat 1)!';
          else if (roll.passed !== undefined) outcomeText = roll.passed ? ' ✅ УСПЕХ' : ' ❌ ПРОВАЛ';

          const rollMessageText = `🎲 [Бросок: ${charName}] ${roll.statOrSkill || 'Проверка'}: d20 (${roll.rolls?.[0] || roll.total - roll.modifier}) ${modStr} = **ИТОГО: ${roll.total}**${roll.dc ? ` (против DC ${roll.dc})` : ''}${outcomeText}`;

          const rollChatMsg = {
            id: 'msg_roll_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            role: 'user',
            text: rollMessageText,
            timestamp: Date.now(),
            gameTime: roomState.inGameTime,
            senderId: roll.characterId || clientData?.player?.id || clientId,
            senderName: charName,
            senderCharacterName: charName,
            senderClass: charClass,
            senderColor: clientData?.player?.color || '#f59e0b',
            rollResult: roll,
            rollRequest: rollReq,
          };

          roomState.history.push(rollChatMsg);
          roomState.pendingRoll = null;

          broadcast({
            type: 'ROLL_RESOLVED_BROADCAST',
            rollMessage: rollChatMsg,
            rollResult: roll,
          });
          broadcast({ type: 'CHAT_MESSAGE', message: rollChatMsg });
          break;
        }

        case 'DM_START_THINKING': {
          roomState.isDmThinking = true;
          broadcast({ type: 'DM_START_THINKING' });
          break;
        }

        case 'DM_RESPONSE': {
          roomState.isDmThinking = false;
          roomState.roundActions = {};
          const dmMsg = msg.message;
          if (dmMsg) roomState.history.push(dmMsg);
          if (msg.pendingRoll !== undefined) roomState.pendingRoll = msg.pendingRoll;
          if (msg.stateUpdate?.location_name) roomState.currentLocation = msg.stateUpdate.location_name;
          if (msg.stateUpdate?.new_time) roomState.inGameTime = msg.stateUpdate.new_time;
          if (msg.stateUpdate?.new_day) roomState.inGameDay = msg.stateUpdate.new_day;

          broadcast({
            type: 'DM_RESPONSE',
            message: dmMsg,
            stateUpdate: msg.stateUpdate,
            pendingRoll: msg.pendingRoll,
            suggestedActions: msg.suggestedActions,
            nearbyNpcs: msg.nearbyNpcs,
          });
          broadcast({ type: 'ROUND_STATE_UPDATE', roundActions: {} });
            if (msg.pendingRoll && msg.pendingRoll.needed) {
              broadcast({ type: 'ROLL_REQUEST_BROADCAST', pendingRoll: msg.pendingRoll });
            }
            break;
          }

        case 'UPDATE_STATE_HOST': {
          const incoming = msg.state || {};
          if (incoming.currentLocation) roomState.currentLocation = incoming.currentLocation;
          if (incoming.inGameDay) roomState.inGameDay = incoming.inGameDay;
          if (incoming.inGameMinutes !== undefined) roomState.inGameMinutes = incoming.inGameMinutes;
          if (incoming.inGameTime) roomState.inGameTime = incoming.inGameTime;
          if (incoming.history) roomState.history = incoming.history;
          if (incoming.partyCompanions) roomState.partyCompanions = incoming.partyCompanions;

          broadcast({
            type: 'STATE_SYNC',
            currentLocation: roomState.currentLocation,
            inGameDay: roomState.inGameDay,
            inGameMinutes: roomState.inGameMinutes,
            inGameTime: roomState.inGameTime,
            partyCompanions: roomState.partyCompanions,
          }, ws);
          break;
        }

        case 'PING': {
          sendTo(ws, {
            type: 'PONG',
            clientTimestamp: msg.timestamp,
            serverTimestamp: Date.now(),
          });
          break;
        }
      }
    } catch (err) {
      console.error('[Standalone WS Error]:', err);
    }
  });

  ws.on('close', () => {
    const client = connectedClients.get(clientId);
    const player = client?.player;
    connectedClients.delete(clientId);
    if (player) {
      roomState.players = roomState.players.filter((p) => p.id !== player.id);
      broadcast({ type: 'PLAYER_LEFT', playerId: player.id, playerName: player.name });
    }
  });
});

server.listen(PORT, HOST, () => {
  const lanIp = getLanIp();
  console.log(`[Standalone LAN WS Server] Running on ws://${lanIp}:${PORT}`);
});

let isShuttingDown = false;
function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[Standalone LAN WS Server] Shutting down...');

  try {
    for (const [id, client] of connectedClients.entries()) {
      try {
        client.ws.terminate();
      } catch (e) {}
    }
    connectedClients.clear();
    wss.close();
  } catch (e) {}

  try {
    server.close(() => process.exit(exitCode));
  } catch (e) {
    process.exit(exitCode);
  }

  setTimeout(() => process.exit(exitCode), 400).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGBREAK', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));

try {
  if (process.stdin && process.stdin.isTTY && typeof process.stdin.resume === 'function') {
    process.stdin.resume();
    process.stdin.on('end', () => shutdown(0));
    process.stdin.on('close', () => shutdown(0));
  }
} catch (e) {}
