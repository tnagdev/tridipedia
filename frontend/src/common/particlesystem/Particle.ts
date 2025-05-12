import colors from "tailwindcss/colors";
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
    maxSize: number = 2;
    minSize: number = 5;
    grow = 0.1;
    history: { x: number, y: number }[] = []
    trailLength: number;
    speedVarince: number;
    life: number = 2000;
    angle;

    constructor(system: Effect) {
        this.system = system;
        this.size = getRandomNumber(this.minSize, this.maxSize);
        this.x = getRandomNumber(this.size, this.system.width - this.size);
        this.y = getRandomNumber(this.size, this.system.height - this.size);
        this.speedX = getRandomNumber(0.1, 2);
        this.speedY = getRandomNumber(0.1, 2);
        this.history = [{ x: this.x, y: this.y }]
        this.speedVarince = getRandomNumber(0, 1);
        this.trailLength = getRandomNumber(10, 20)
        this.life = this.trailLength * 2;
        this.angle = 0;
    }

    reset() {
        this.x = getRandomNumber(this.size, this.system.width - this.size);
        this.y = getRandomNumber(this.size, this.system.height - this.size);
        this.speedX = getRandomNumber(0.1, 2);
        this.speedY = getRandomNumber(0.1, 2);
        this.history = [{ x: this.x, y: this.y }]
        this.life = this.trailLength * 2;
        this.angle = 0;
    }

    render() {
        this.system.ctx.fillStyle = this.isCollided ? colors.green[500] : 'white';
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
        this.angle += 0.02;
        if (this.angle > 2 * Math.PI) this.angle = 0;

        this.x += this.speedX;
        this.y += this.speedY;

        if (
            this.x >= (this.system.width - 2 * this.size) ||
            this.x - 2 * this.size <= 0
        ) {
            this.isCollided = true;
            this.speedX = - this.speedX;
            this.angle = - this.angle;
        }

        if (
            this.y >= (this.system.height - 2 * this.size) ||
            this.y - 2 * this.size <= 0
        ) {
            this.isCollided = true;
            this.speedY = - this.speedY;
            this.angle = - this.angle;
        }

        if (this.isCollided) setTimeout(() => this.isCollided = false, 1000);
    }
}

export default Particle;