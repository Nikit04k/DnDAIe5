const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const next = require('next');
const { WebSocketServer, WebSocket } = require('ws');
const os = require('os');

const dev = process.env.NODE_ENV === 'development';
const appDir = process.env.APP_DIR || path.resolve(__dirname);
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, dir: appDir, hostname, port });
const handle = app.getRequestHandler();

// Room state stored in-memory on the LAN Host Server
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

// Connected sockets map: socketId -> { ws, player }
const connectedClients = new Map();

let serverInstance = null;
let wssInstance = null;
let isShuttingDown = false;

function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[DnDAIe5] Завершение работы сервера и освобождение портов...');

  try {
    for (const [id, client] of connectedClients.entries()) {
      try {
        client.ws.terminate();
      } catch (e) {}
    }
    connectedClients.clear();
  } catch (e) {}

  try {
    if (wssInstance) {
      wssInstance.close();
    }
  } catch (e) {}

  try {
    if (serverInstance) {
      serverInstance.close(() => {
        process.exit(exitCode);
      });
    } else {
      process.exit(exitCode);
    }
  } catch (e) {
    process.exit(exitCode);
  }

  // Force exit after 500ms if lingering keep-alive sockets delay graceful close
  setTimeout(() => {
    process.exit(exitCode);
  }, 500).unref();
}

function broadcast(message, excludeWs = null) {
  const payload = JSON.stringify(message);
  for (const [id, client] of connectedClients.entries()) {
    if (client.ws.readyState === WebSocket.OPEN && client.ws !== excludeWs) {
      try {
        client.ws.send(payload);
      } catch (err) {
        console.error(`[WS Broadcast Error to ${id}]:`, err);
      }
    }
  }
}

function sendTo(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('[WS Send Error]:', err);
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

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  serverInstance = server;

  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[DnDAIe5 Error] Порт ${port} уже занят другим процессом!`);
      console.error(`Закройте предыдущую копию приложения или завершите процесс, занимающий порт ${port}.\n`);
      if (process.versions?.electron) {
        try {
          const { dialog } = require('electron');
          dialog.showErrorBox(
            'DnDAIe5 — Порт занят',
            `Порт ${port} уже занят другой запущенной копией игры или другой программой.\n\nПожалуйста, закройте предыдущий процесс DnDAIe5 в Диспетчере задач и повторите запуск.`
          );
        } catch (e) {}
      }
      process.exit(1);
    } else {
      console.error('[DnDAIe5 Server Error]:', err);
      process.exit(1);
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);

    if (pathname === '/ws' || pathname === '/api/ws' || pathname === '/lan-ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      // Allow Next.js HMR or other upgrade handlers if needed
      // If not /ws, we let standard socket close or pass through
    }
  });

  wss.on('connection', (ws, req) => {
    const clientId = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    connectedClients.set(clientId, { ws, player: null });

    console.log(`[LAN WS] Client connected: ${clientId} (Total: ${connectedClients.size})`);

    // Send initial snapshot of room state to connecting client
    sendTo(ws, {
      type: 'ROOM_STATE',
      state: {
        ...roomState,
        isHost: roomState.players.length === 0, // First connected player can act as default host if needed
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

            // Upsert player into roomState.players
            const existingIdx = roomState.players.findIndex((p) => p.id === newPlayer.id || p.name === newPlayer.name);
            if (existingIdx >= 0) {
              roomState.players[existingIdx] = newPlayer;
            } else {
              roomState.players.push(newPlayer);
            }

            console.log(`[LAN WS] Player joined: "${newPlayer.name}" (${newPlayer.character?.class || 'No Class'}) [${newPlayer.id}]`);

            // Broadcast join to all
            broadcast({
              type: 'PLAYER_JOINED',
              player: newPlayer,
            });

            // Send updated full state
            broadcast({
              type: 'ROOM_STATE',
              state: roomState,
            });
            break;
          }

          case 'UPDATE_CHARACTER': {
            if (clientData && clientData.player) {
              clientData.player.character = msg.character;
              clientData.player.name = msg.character?.name || clientData.player.name;
              const idx = roomState.players.findIndex((p) => p.id === clientData.player.id);
              if (idx >= 0) {
                roomState.players[idx].character = msg.character;
                roomState.players[idx].name = msg.character?.name || roomState.players[idx].name;
              }
              broadcast({
                type: 'PLAYER_UPDATED',
                player: clientData.player,
              });
            }
            break;
          }

          case 'SET_READY': {
            if (clientData && clientData.player) {
              clientData.player.isReady = Boolean(msg.isReady);
              const idx = roomState.players.findIndex((p) => p.id === clientData.player.id);
              if (idx >= 0) {
                roomState.players[idx].isReady = Boolean(msg.isReady);
              }
              broadcast({
                type: 'PLAYER_READY_CHANGED',
                playerId: clientData.player.id,
                isReady: Boolean(msg.isReady),
              });
              broadcast({
                type: 'PLAYER_UPDATED',
                player: clientData.player,
              });
            }
            break;
          }

          case 'UPDATE_LOBBY_SETTINGS': {
            broadcast({
              type: 'LOBBY_SETTINGS_UPDATED',
              difficulty: msg.difficulty,
            });
            break;
          }

          case 'START_GAME': {
            broadcast({
              type: 'GAME_STARTED',
              difficulty: msg.difficulty,
              worldSettings: msg.worldSettings,
            });
            break;
          }

          case 'SEND_ACTION': {
            const charName = msg.characterName || (clientData?.player?.name) || 'Герой';
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

            console.log(`[LAN WS] Action from [${charName}]: ${msg.actionText.substring(0, 60)}... (Round Ready: ${Object.keys(roomState.roundActions).length}/${roomState.players.length})`);

            broadcast({
              type: 'CHAT_MESSAGE',
              message: actionMsg,
            });

            broadcast({
              type: 'ROUND_STATE_UPDATE',
              roundActions: roomState.roundActions,
            });
            break;
          }

          case 'FORCE_DM_TURN': {
            broadcast({
              type: 'FORCE_DM_TURN',
            });
            break;
          }

          case 'SUBMIT_ROLL': {
            const roll = msg.rollResult;
            const rollReq = msg.rollReq;
            const charName = roll.characterName || (clientData?.player?.name) || 'Герой';
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

            console.log(`[LAN WS] Roll resolved by [${charName}]: ${roll.total} (DC: ${roll.dc})`);

            broadcast({
              type: 'ROLL_RESOLVED_BROADCAST',
              rollMessage: rollChatMsg,
              rollResult: roll,
            });

            broadcast({
              type: 'CHAT_MESSAGE',
              message: rollChatMsg,
            });
            break;
          }

          case 'DM_START_THINKING': {
            roomState.isDmThinking = true;
            broadcast({
              type: 'DM_START_THINKING',
            });
            break;
          }

          case 'DM_RESPONSE': {
            roomState.isDmThinking = false;
            roomState.roundActions = {};
            const dmMsg = msg.message;
            if (dmMsg) {
              roomState.history.push(dmMsg);
            }
            if (msg.pendingRoll !== undefined) {
              roomState.pendingRoll = msg.pendingRoll;
            }
            if (msg.stateUpdate?.location_name) {
              roomState.currentLocation = msg.stateUpdate.location_name;
            }
            if (msg.stateUpdate?.new_time) {
              roomState.inGameTime = msg.stateUpdate.new_time;
            }
            if (msg.stateUpdate?.new_day) {
              roomState.inGameDay = msg.stateUpdate.new_day;
            }

            broadcast({
              type: 'DM_RESPONSE',
              message: dmMsg,
              stateUpdate: msg.stateUpdate,
              pendingRoll: msg.pendingRoll,
              suggestedActions: msg.suggestedActions,
              nearbyNpcs: msg.nearbyNpcs,
            });

            broadcast({
              type: 'ROUND_STATE_UPDATE',
              roundActions: {},
            });

            if (msg.pendingRoll && msg.pendingRoll.needed) {
              broadcast({
                type: 'ROLL_REQUEST_BROADCAST',
                pendingRoll: msg.pendingRoll,
              });
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

          default:
            console.log(`[LAN WS] Unknown message type: ${msg.type}`);
        }
      } catch (err) {
        console.error('[LAN WS Message Parsing Error]:', err);
      }
    });

    ws.on('close', () => {
      const client = connectedClients.get(clientId);
      const player = client?.player;
      connectedClients.delete(clientId);

      if (player) {
        roomState.players = roomState.players.filter((p) => p.id !== player.id);
        console.log(`[LAN WS] Player left: "${player.name}" [${player.id}]`);
        broadcast({
          type: 'PLAYER_LEFT',
          playerId: player.id,
          playerName: player.name,
        });
      }
    });
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    const lanIp = getLanIp();
    console.log(`\n======================================================`);
    console.log(`  🐉 DnDAIe5 - LAN Multiplayer Server Active!`);
    console.log(`  > Local:            http://localhost:${port}`);
    console.log(`  > LAN IP for Party: http://${lanIp}:${port}`);
    console.log(`  > WebSocket LAN:    ws://${lanIp}:${port}/ws`);
    console.log(`======================================================\n`);
  });

  // Comprehensive OS & Console Signal Handlers
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  process.on('SIGBREAK', () => shutdown(0)); // Windows Ctrl+Break and console close event
  process.on('SIGHUP', () => shutdown(0));   // Terminal closed / hung up

  // Only watch standard input in standalone CLI terminal mode, never in Electron or GUI non-TTY
  try {
    if (!process.versions?.electron && process.stdin && process.stdin.isTTY && typeof process.stdin.resume === 'function') {
      process.stdin.resume();
      process.stdin.on('end', () => shutdown(0));
      process.stdin.on('close', () => shutdown(0));

      if (process.platform === 'win32') {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.on('SIGINT', () => shutdown(0));
        rl.on('SIGBREAK', () => shutdown(0));
        rl.on('close', () => shutdown(0));
      }
    }
  } catch (e) {}

  process.on('uncaughtException', (err) => {
    if (
      err?.message?.includes?.('audio') ||
      err?.message?.includes?.('turnEnded') ||
      err?.stack?.includes?.('msedge-tts') ||
      err?.stack?.includes?.('MsEdgeTTS')
    ) {
      console.warn('[Handled Uncaught TTS Stream Race]:', err.message);
      return;
    }
    console.error('[Uncaught Exception]:', err);
  });
});

module.exports = {
  shutdown,
  get server() { return serverInstance; },
  get wss() { return wssInstance; },
};
