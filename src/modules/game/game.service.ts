import { Card, GameRoom, Player } from "src/shared/interfaces/game.interface";
import { GameSetupService } from "./game-setup.service";
import { RoomService } from "../socket/room.service";
import { WsException } from "@nestjs/websockets";
import { CardSuit, CardType, GameDirection } from "../../shared/enums/game.enum";
import { LogType } from "src/shared/enums/log.enum";
import { Injectable } from "@nestjs/common";
import { ActionValidatorRegistry } from "./validators/action-validator.registry";
import { GameLog } from "src/shared/interfaces/log.interface";
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GameService {
  constructor(
    private readonly gameSetupService: GameSetupService,
    private readonly roomService: RoomService,
    private readonly actionValidatorRegistry: ActionValidatorRegistry,
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

    const isParticipant = room.players.some(
      (player) => player.userId === userId,
    );

    if (!isParticipant) {
      throw new WsException('User is not a participant of this room');
    }

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

  playCard(
    userId: string,
    cardId: string,
    chosenSuit?: CardSuit,
  ): GameRoom {
    const room = this.getValidRoom(userId);
    const player = this.getPlayablePlayer(room, userId);
    const card = this.getCardFromHand(player, cardId);

    const validator =
      this.actionValidatorRegistry.getValidator(card);

    validator.validate({
      room,
      player,
      card,
      chosenSuit,
    });

    if (card.type === CardType.WILD) {
      card.declaredSuit = chosenSuit!;
    }

    player.hand = player.hand.filter(
      (handCard) => handCard.id !== card.id,
    );
    player.cardCount = player.hand.length;

    this.pushToDiscardPile(room, card);
    this.applyCardEffect(room, player, card);
    this.pushPlayCardLog(room, player, card);

    room.lastActionId += 1;

    return room;
  }

  private getPlayablePlayer(
    room: GameRoom,
    userId: string,
  ): Player {
    const player = room.players.find(
      (candidate) => candidate.userId === userId,
    );

    if (!player) {
      throw new WsException(
        'Player not found in room',
      );
    }

    return player;
  }

  private getCardFromHand(
    player: Player,
    cardId: string,
  ): Card {
    const card = player.hand.find(
      (handCard) => handCard.id === cardId,
    );

    if (!card) {
      throw new WsException(
        'Card not found in hand',
      );
    }

    return card;
  }

  private applyCardEffect(
    room: GameRoom,
    player: Player,
    card: Card,
  ): void {
    let advanceSteps = 1;
    let keepTurn = false;

    if (card.type === CardType.ATTACK) {
      room.attackStack += card.power;
      room.currentPower = card.power;
    } else if (card.type === CardType.NUMBER) {
      room.attackStack = 0;
      room.currentPower = 0;
      room.isBonusTurn = false;
    } else if (card.type === CardType.SPECIAL) {
      switch (card.value) {
        case 'SHIELD':
          room.attackStack = 0;
          room.currentPower = 0;
          room.isBonusTurn = false;
          break;
        case 'EVADE':
          // intentinally no-op
          break;
        case 'BONUS':
          keepTurn = true;
          room.isBonusTurn = true;
          break;
        case 'REVERSE':
          room.direction =
            room.direction === GameDirection.CLOCKWISE
              ? GameDirection.COUNTER_CLOCKWISE
              : GameDirection.CLOCKWISE;
          room.isBonusTurn = false;
          break;
        case 'JUMP':
          advanceSteps = 2;
          room.isBonusTurn = false;
          break;
        default:
          room.isBonusTurn = false;
          break;
      }
    } else if (card.type === CardType.WILD) {
      // Wild는 suit 선언만 변경하고 턴/보너스 상태만 일반 진행으로 정리한다.
      room.isBonusTurn = false;
    } else {
      room.isBonusTurn = false;
    }

    if (keepTurn) {
      room.turnOwner = player.userId;
      return;
    }

    let nextTurnOwner = player.userId;
    for (let i = 0; i < advanceSteps; i += 1) {
      nextTurnOwner = this.roomService.getNextTurnOwner(
        room,
        nextTurnOwner,
      );
    }
    room.turnOwner = nextTurnOwner;
  }

  private pushPlayCardLog(
    room: GameRoom,
    player: Player,
    card: Card,
  ): void {
    const logType = this.resolvePlayLogType(card);

    const log: GameLog = {
      id: uuidv4(),
      type: logType,
      actorId: player.userId,
      actorName: player.nickname,
      cardId: card.id,
      payload: {
        suit: card.suit,
        power: card.power,
        attackStack: room.attackStack,
      },
      timestamp: Date.now(),
    };

    if (card.type === CardType.ATTACK && room.turnOwner) {
      log.targetId = room.turnOwner;
    }

    this.roomService.pushLog(room, log);
  }

  private resolvePlayLogType(
    card: Card,
  ): LogType {
    if (card.type === CardType.ATTACK) {
      return LogType.ATTACK;
    }

    if (card.type === CardType.SPECIAL) {
      switch (card.value) {
        case 'SHIELD':
          return LogType.DEFENSE;
        case 'EVADE':
          return LogType.EVADE;
        case 'BONUS':
          return LogType.BONUS;
        case 'REVERSE':
          return LogType.REVERSE;
        case 'JUMP':
          return LogType.SKIP;
        default:
          return LogType.NOTICE;
      }
    }

    return LogType.NOTICE;
  }

  getGameState(userId: string): GameRoom {
    const room = this.getValidRoom(userId);
    return room;
  }
}  
