import colors from "tailwindcss/colors";
import Particle from "./Particle";

class Effect {

    container: HTMLElement;
    canvas!: HTMLCanvasElement;
    ctx!: CanvasRenderingContext2D;
    height!: number;
    width!: number;
    particles: Particle[] = [];
    noOfParticles = 30;
    isAnimate = true;
    cellSize = 5;
    flowField: any[] = [];
    rows!: number;
    cols!: number;
    zoom: number = 0.1;
    curve: number = 0.5;

    constructor(containerId: string) {
        this.container = document.getElementById(containerId) as HTMLElement;
        if (this.container.querySelector('canvas#anime'))
            this.container.removeChild(this.container.querySelector('canvas#anime') as Node)

        this.initCanvas = this.initCanvas.bind(this);
        this.initEffect = this.initEffect.bind(this);
        this.render = this.render.bind(this);
        this.renderText = this.renderText.bind(this);
        this.initCanvas();
        this.initEffect();
    }

    initCanvas() {
        if (!this.container) return;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'anime';
        this.canvas.style.position = 'absolute';
        this.canvas.style.zIndex = '1';
        this.container.style.position = 'relative';
        const style = getComputedStyle(this.container);
        this.canvas.style.top = style.paddingTop;
        this.canvas.style.left = style.paddingLeft;
        this.height = this.container.clientHeight - (parseInt(style.paddingTop) + parseInt(style.paddingBottom));
        this.width = this.container.clientWidth - (parseInt(style.paddingLeft) + parseInt(style.paddingRight));
        this.canvas.height = this.height;
        this.canvas.width = this.width;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.ctx.fillStyle = colors.green[400];
        this.ctx.strokeStyle = colors.green[400];
        this.ctx.lineWidth = 0.1
    }

    renderText() {
        this.ctx.font = (this.width * 0.3) + 'px Impact';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'red';
        this.ctx.fillText('Cool', this.width / 2, this.height / 2);
    }

    initText() {
        this.renderText();
        const pixels = this.ctx.getImageData(0, 0, this.width, this.height).data;
        for (let y = 0; y < this.height; y += this.cellSize) {
            for (let x = 0; x < this.width; x += this.cellSize) {
                const index = (y * this.width + x) * 4;
                const red = pixels[index];
                const green = pixels[index + 1];
                const blue = pixels[index + 2];
                const alpha = pixels[index + 3];
                const avg = (red + green + blue) / 3;
                const angle = Number(((avg / 255) * Math.PI * 2).toFixed(2));
                this.flowField.push({ x, y, angle });
            }
        }
    }

    initEffect() {
        this.rows = Math.floor(this.width / this.cellSize);
        this.cols = Math.floor(this.height / this.cellSize);
        for (let i = 0; i < this.noOfParticles; i++) {
            this.particles.push(new Particle(this));
        }
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.flowField.push((Math.cos(x * this.zoom) + Math.sin(y * this.zoom)) * this.curve);
            }
        }
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        for (const particle of this.particles) {
            particle.render();
            particle.update();
        }
        requestAnimationFrame(this.render);
    }
}

export default Effect;