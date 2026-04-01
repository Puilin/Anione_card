import { Card, GameRoom, Player } from "src/shared/interfaces/game.interface";
import { GameSetupService } from "./game-setup.service";
import { RoomService } from "../socket/room.service";
import { WsException } from "@nestjs/websockets";
import { CardType, GameDirection } from "../../shared/enums/game.enum";
import { LogType } from "src/shared/enums/log.enum";
import { Injectable } from "@nestjs/common";

@Injectable()
export class GameService {
  constructor(
    private readonly gameSetupService: GameSetupService,
    private readonly roomService: RoomService
  ) { }

  startGame(userId: string): GameRoom {
    const room = this.getValidRoom(userId);

    this.validateGameStart(room, userId);

    const { updatedPlayers, remainingDeck } =
      this.setupPlayersAndDeck(room);

    const firstCard = this.selectFirstCard(remainingDeck);

    this.initializeGameState(room, updatedPlayers, remainingDeck, firstCard);

    // TODO (ANI-13): 향후 영속 로그 저장을 위해 LogRepository 연동 및 비동기 큐 도입 예정
    this.roomService.pushLog(
      room,
      this.roomService.createSystemLog(room, room.hostId, LogType.GAME_START, '게임이 시작되었습니다.')
    );

    return room;
  }

  private getValidRoom(userId: string): GameRoom {
    const roomId = this.roomService.getUserRoom(userId);
    if (!roomId) throw new WsException('User is not in any room');

    const room = this.roomService.getRoom(roomId);
    if (!room) throw new WsException('Room not found');

    return room;
  }

  private validateGameStart(room: GameRoom, userId: string) {
    if (room.hostId !== userId) {
      throw new WsException('Only host can start the game');
    }

    if (room.status !== 'WAITING') {
      throw new WsException('Game already started or finished');
    }

    const players = room.players.filter(p => p.role === 'PLAYER');

    if (players.length < 2) {
      throw new WsException('Not enough players to start');
    }

    if (!players.every(p => p.isReady)) {
      throw new WsException('All players must be ready');
    }
  }

  private setupPlayersAndDeck(room: GameRoom) {
    const players = room.players.filter(p => p.role === 'PLAYER');

    const deck = this.gameSetupService.createDeck();
    this.gameSetupService.shuffle(deck);

    const { updatedPlayers, remainingDeck } =
      this.gameSetupService.distributeCards(deck, players, 7);

    return { updatedPlayers, remainingDeck };
  }

  private selectFirstCard(deck: Card[]): Card {
    const maxAttempts = deck.length;

    for (let i = 0; i < maxAttempts; i++) {
      const card = deck.shift()!;
      if (card.type === CardType.NUMBER) {
        return card;
      }
      deck.push(card);
    }

    throw new WsException('Failed to find valid starting card');
  }

  private initializeGameState(
    room: GameRoom,
    updatedPlayers: Player[],
    remainingDeck: Card[],
    firstCard: Card
  ) {
    // players merge
    room.players = room.players.map(p => {
      const updated = updatedPlayers.find(up => up.userId === p.userId);
      return updated ?? p;
    });

    this.initDiscardPile(room, firstCard);
    room.drawPile = remainingDeck;

    room.status = 'PLAYING';

    const activePlayers = room.players.filter(
      p => p.role === 'PLAYER' && !p.isOut
    );

    const randomIndex = Math.floor(Math.random() * activePlayers.length);
    room.turnOwner = activePlayers[randomIndex].userId;

    room.direction = GameDirection.CLOCKWISE;
    room.attackStack = 0;
    room.currentPower = 0;
    room.lastActionId = 0;
  }

  private initDiscardPile(room: GameRoom, card: Card) {
    room.discardPile = [card];
    room.lastCard = card;
  }

  private pushToDiscardPile(room: GameRoom, card: Card) {
    room.discardPile.push(card);
    room.lastCard = card;
  }

}  