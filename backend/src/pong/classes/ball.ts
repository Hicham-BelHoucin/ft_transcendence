import { Canvas } from './canvas';

class Ball {
  public x: number;
  public y: number;
  public radius: number;
  public speed: number;
  public velocity: {
    x: number;
    y: number;
  };
  public servedAt: number;

  getDuration() {
    const currentTime = new Date().getTime();
    const durationInSeconds = Math.floor((currentTime - this.servedAt) / 1000);
    return durationInSeconds;
  }

  constructor(canvas: Canvas) {
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.speed = 15;
    this.radius = 10;
    this.velocity = {
      x: 2,
      y: 2,
    };
    this.servedAt = new Date().getTime();
  }
  reset(canvas: Canvas) {
    this.servedAt = new Date().getTime();
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.speed = 10;
    this.velocity = {
      x: 2,
      y: 2,
    };
  }
}

export { Ball };
