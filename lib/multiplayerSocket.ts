'use client';

import {
  CharacterSheet,
  ChatMessage,
  DiceRollResult,
  MultiplayerRoomState,
  RollRequirement,
  StateUpdate,
  WsClientMessage,
  WsServerMessage,
} from '@/types/dnd';

type EventCallback = (msg: WsServerMessage) => void;

class MultiplayerSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Set<EventCallback> = new Set();
  private pingIntervalId: any = null;
  private reconnectTimeoutId: any = null;
  private url: string = '';
  private playerInfo: { id: string; name: string; character: CharacterSheet; isHost?: boolean; color?: string } | null = null;
  private _isConnected: boolean = false;
  private _ping: number = 0;

  public get isConnected(): boolean {
    return this._isConnected;
  }

  public get ping(): number {
    return this._ping;
  }

  public connect(
    serverAddress: string,
    player: { id: string; name: string; character: CharacterSheet; isHost?: boolean; color?: string }
  ) {
    this.playerInfo = player;
    this.disconnect();

    let cleanAddr = serverAddress.trim();
    if (!cleanAddr) {
      cleanAddr = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    }

    // Determine ws:// or wss://
    let protocol = 'ws:';
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      protocol = 'wss:';
    }

    // Strip http:// or https:// or ws:// from address
    cleanAddr = cleanAddr.replace(/^https?:\/\//i, '').replace(/^wss?:\/\//i, '').replace(/\/+$/, '');

    // Form websocket URL
    if (cleanAddr.endsWith('/ws') || cleanAddr.endsWith('/api/ws')) {
      this.url = `${protocol}//${cleanAddr}`;
    } else {
      this.url = `${protocol}//${cleanAddr}/ws`;
    }

    console.log(`[LAN Client] Connecting to: ${this.url}`);

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log(`[LAN Client] Connected to ${this.url}`);
        this._isConnected = true;
        if (this.reconnectTimeoutId) {
          clearTimeout(this.reconnectTimeoutId);
          this.reconnectTimeoutId = null;
        }

        // Join room immediately upon connection
        if (this.playerInfo) {
          this.send({
            type: 'JOIN_ROOM',
            player: this.playerInfo,
          });
        }

        // Start periodic ping
        this.startPing();
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: WsServerMessage = JSON.parse(event.data);
          if (msg.type === 'PONG') {
            this._ping = Math.max(1, Date.now() - msg.clientTimestamp);
          }
          this.emit(msg);
        } catch (err) {
          console.error('[LAN WS Parse Error]:', err);
        }
      };

      this.socket.onclose = () => {
        console.log('[LAN Client] Connection closed.');
        this._isConnected = false;
        this.stopPing();
      };

      this.socket.onerror = (err) => {
        console.warn('[LAN WS Error]:', err);
      };
    } catch (err) {
      console.error('[LAN Client Connection Error]:', err);
      this._isConnected = false;
    }
  }

  public disconnect() {
    this.stopPing();
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this._isConnected = false;
  }

  public send(msg: WsClientMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(msg));
      } catch (err) {
        console.error('[LAN Send Error]:', err);
      }
    }
  }

  public sendAction(
    actionText: string,
    characterId: string,
    characterName: string,
    playerClass?: string,
    playerRace?: string,
    playerColor?: string
  ) {
    this.send({
      type: 'SEND_ACTION',
      actionText,
      characterId,
      characterName,
      playerClass,
      playerRace,
      playerColor,
    });
  }

  public submitRoll(rollResult: DiceRollResult, rollReq: RollRequirement) {
    this.send({
      type: 'SUBMIT_ROLL',
      rollResult,
      rollReq,
    });
  }

  public updateCharacter(character: CharacterSheet) {
    this.send({
      type: 'UPDATE_CHARACTER',
      character,
    });
  }

  public broadcastDmThinking() {
    this.send({
      type: 'DM_START_THINKING' as any,
    });
  }

  public broadcastDmResponse(
    message: ChatMessage,
    stateUpdate: StateUpdate,
    pendingRoll: RollRequirement | null,
    suggestedActions?: string[],
    nearbyNpcs?: any[]
  ) {
    this.send({
      type: 'DM_RESPONSE' as any,
      message,
      stateUpdate,
      pendingRoll,
      suggestedActions,
      nearbyNpcs,
    } as any);
  }

  public broadcastStateSync(state: Partial<MultiplayerRoomState>) {
    this.send({
      type: 'UPDATE_STATE_HOST',
      state,
    });
  }

  public subscribe(cb: EventCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(msg: WsServerMessage) {
    for (const listener of this.listeners) {
      try {
        listener(msg);
      } catch (err) {
        console.error('[LAN Listener Error]:', err);
      }
    }
  }

  private startPing() {
    this.stopPing();
    this.pingIntervalId = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING', timestamp: Date.now() });
      }
    }, 5000);
  }

  private stopPing() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }
}

export const lanSocket = new MultiplayerSocketManager();
