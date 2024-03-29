import { Canvas } from './canvas';
import { Socket } from 'socket.io';
import { AchievementsWatcher } from './../services/achievementswatcher.service';

class Player {
  public id: number;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public canvas: Canvas;
  public score: number;
  public speed: number;
  public consecutivePoints: number;
  public AllBlockedShots: number;
  public consecutiveBlockedShots: number;
  public paddleWizard: boolean;
  public paddleMaster: boolean;
  public keyState: {
    ArrowUp: boolean;
    ArrowDown: boolean;
  };
  public powerup: boolean;
  public socket: Socket | null;
  public scoredInCorner: boolean;
  public acheivementsWatcher: AchievementsWatcher;
  constructor(
    id: number,
    canvas: Canvas,
    socket: Socket | null,
    achievedAchievements,
  ) {
    this.powerup = false;
    this.id = id;
    this.width = 10;
    this.height = canvas.height / 5;
    this.x = 0;
    this.consecutiveBlockedShots = 0;
    this.paddleWizard = true;
    this.paddleMaster = true;
    this.AllBlockedShots = 0;
    this.consecutivePoints = 0;
    this.y = canvas.height / 2 - this.height / 2;
    this.canvas = new Canvas(canvas);
    this.score = 0;
    this.keyState = {
      ArrowUp: false,
      ArrowDown: false,
    };
    this.socket = socket;
    this.acheivementsWatcher = new AchievementsWatcher(
      this,
      achievedAchievements,
    );
  }
}

export { Player };
