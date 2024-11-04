import Effect from "./Effect";
import { getRandomNumber } from "@/utils/utils";

class Particle {
    system: Effect;
    x!: number;
    y!: number;
    speedX!: number;
    speedY!: number;
    isCollided = false;
    size: number;
    maxSize: number = 0.1;
    minSize: number = 0.1;
    grow = 0.1;
    history: { x: number, y: number }[] = []
    trailLength: number;
    speedVarince: number;
    life: number = 200;

    constructor(system: Effect) {
        this.system = system;
        this.size = getRandomNumber(this.minSize, this.maxSize);
        this.x = getRandomNumber(this.size, this.system.width - this.size);
        this.y = getRandomNumber(this.size, this.system.height - this.size);
        this.speedX = getRandomNumber(-2, 2);
        this.speedY = getRandomNumber(-2, 2);
        this.history = [{ x: this.x, y: this.y }]
        this.speedVarince = getRandomNumber(1, 5);
        this.trailLength = getRandomNumber(20, 50)
        this.life = this.trailLength * 2;
    }

    reset() {
        this.x = getRandomNumber(this.size, this.system.width - this.size);
        this.y = getRandomNumber(this.size, this.system.height - this.size);
        this.speedX = getRandomNumber(-2, 2);
        this.speedY = getRandomNumber(-2, 2);
        this.history = [{ x: this.x, y: this.y }]
        this.life = this.trailLength * 2;
    }

    render() {
        this.system.ctx.fillStyle = this.isCollided ? 'red' : 'white';
        this.system.ctx.stroke();
        this.system.ctx.beginPath();
        this.system.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.system.ctx.fill();
        this.system.ctx.closePath();
        this.system.ctx.beginPath();
        this.system.ctx.moveTo(this.history[0].x, this.history[0].y)
        for (const history of this.history) {
            this.system.ctx.lineTo(history.x, history.y);
            this.system.ctx.stroke();
        }
    }

    update() {
        this.life--;
        if (this.life <= 1) {
            if (this.history.length > 1) {
                this.history.shift();
            } else {
                this.reset();
            }
            return;
        }
        // const x = Math.floor(this.x / this.system.cellSize);
        // const y = Math.floor(this.y / this.system.cellSize);
        // const cellIndex = y * this.system.cols + x;
        // const angle = this.system.flowField[cellIndex];
        // const angle = this.system.flowField[cellIndex]?.angle || 0;

        // this.speedX = Math.cos(angle);
        // this.speedY = Math.sin(angle);

        this.x += this.speedX * this.speedVarince;
        this.y += this.speedY * this.speedVarince;

        if (
            this.x > (this.system.width - 2 * this.size) ||
            this.x - this.size < 0
        ) {
            this.isCollided = true;
            this.speedX = -this.speedX;
        }

        if (
            this.y > (this.system.height - 2 * this.size) ||
            this.y - this.size < 0
        ) {
            this.isCollided = true;
            this.speedY = - this.speedY;
        }

        this.history.push({ x: this.x, y: this.y })
        if (this.history.length > this.trailLength) {
            this.history.shift();
        }

        // if (this.size >= this.maxSize || this.size <= this.minSize) {
        //     this.grow = -this.grow
        // }

        if (this.isCollided) setTimeout(() => this.isCollided = false, 1000);
    }
}

export default Particle;