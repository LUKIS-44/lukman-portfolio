
const canvas = document.getElementById('neural-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];

const PARTICLE_COUNT = 130;
const CONNECTION_DISTANCE = 160;
const MOUSE_RADIUS = 200;

// Track mouse position and movement speed
// NOTE: listeners are on window (not canvas) because canvas has pointer-events:none
let mouse = { x: null, y: null, vx: 0, vy: 0, speed: 0 };
let lastMouseX = null;
let lastMouseY = null;

// Click ripple rings
let ripples = [];

function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

window.addEventListener('mousemove', (e) => {
        const mx = e.clientX;
        const my = e.clientY;

        if (lastMouseX !== null && lastMouseY !== null) {
                const dx = mx - lastMouseX;
                const dy = my - lastMouseY;
                mouse.vx = dx;
                mouse.vy = dy;
                mouse.speed = Math.sqrt(dx * dx + dy * dy);
        }

        mouse.x = mx;
        mouse.y = my;
        lastMouseX = mx;
        lastMouseY = my;
});

document.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
        mouse.speed = 0;
        lastMouseX = null;
        lastMouseY = null;
});

window.addEventListener('click', (e) => {
        const x = e.clientX;
        const y = e.clientY;

        // Spawn expanding ripple ring
        ripples.push({ x, y, r: 0, maxR: 180, alpha: 0.75 });
});

class Particle {
        constructor(x, y, angle, speed) {
                this.x = x !== undefined ? x : Math.random() * width;
                this.y = y !== undefined ? y : Math.random() * height;
                // Home position — particle drifts back here after being repelled
                this.homeX = x !== undefined ? Math.random() * width  : this.x;
                this.homeY = y !== undefined ? Math.random() * height : this.y;
                const dir = angle !== undefined ? angle : Math.random() * Math.PI * 2;
                const spd = speed !== undefined ? speed : (Math.random() * 0.4 + 0.1);
                this.vx = Math.cos(dir) * spd;
                this.vy = Math.sin(dir) * spd;
                this.baseSize = Math.random() * 2 + 1.4;
                this.size = this.baseSize;
                this.pulseOffset = Math.random() * Math.PI * 2;
                this.proximity = 0; // how close to cursor this frame (0-1)
        }

        update() {
                this.x += this.vx;
                this.y += this.vy;

                // Soft drag so motion feels smooth
                this.vx *= 0.978;
                this.vy *= 0.978;

                // Gentle spring pull back toward home — makes particles return after explosion
                const hx = this.homeX - this.x;
                const hy = this.homeY - this.y;
                const homeDist = Math.sqrt(hx * hx + hy * hy) || 0.0001;
                const returnStrength = Math.min(homeDist * 0.0018, 0.12);
                this.vx += (hx / homeDist) * returnStrength;
                this.vy += (hy / homeDist) * returnStrength;

                // Cap speed so particles never fly off-screen uncontrollably
                const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                if (spd > 6) {
                        this.vx = (this.vx / spd) * 6;
                        this.vy = (this.vy / spd) * 6;
                }

                // Mouse REPULSION — particles explode away from cursor
                if (mouse.x !== null && mouse.y !== null) {
                        const dx = this.x - mouse.x;   // reversed: away from cursor
                        const dy = this.y - mouse.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

                        if (dist < MOUSE_RADIUS) {
                                const normX = dx / dist;
                                const normY = dy / dist;
                                // Strongest right at the cursor, falls off with distance
                                const strength = Math.pow((MOUSE_RADIUS - dist) / MOUSE_RADIUS, 2.0);
                                // Extra kick when cursor moves fast
                                const force = 0.108 + mouse.speed * 0.0036;

                                this.vx += normX * strength * force;
                                this.vy += normY * strength * force;

                                this.proximity = strength;
                        } else {
                                this.proximity *= 0.94;
                        }
                } else {
                        this.proximity *= 0.9;
                }

                // Wrap around edges
                if (this.x > width + 10) this.x = -10;
                if (this.x < -10) this.x = width + 10;
                if (this.y > height + 10) this.y = -10;
                if (this.y < -10) this.y = height + 10;

                // Pulse + scale by proximity so pointers grow near cursor
                const pulse = Math.sin(performance.now() * 0.002 + this.pulseOffset) * 0.6;
                this.size = this.baseSize * (0.8 + this.proximity * 1.4) + pulse;
        }

        draw() {
                // Draw as a small arrow/triangle pointing in direction of travel
                const angle = Math.atan2(this.vy, this.vx) || 0;
                const len = this.size * 3.2;
                const widthHalf = this.size * 0.9;

                // Color/brightness reacts to proximity
                const glowAlpha = 0.25 + this.proximity * 0.5;
                const fillAlpha = 0.5 + this.proximity * 0.4;

                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(angle);

                ctx.shadowColor = `rgba(176,137,104,${glowAlpha})`;
                ctx.shadowBlur = 16 + this.proximity * 10;
                ctx.fillStyle = `rgba(176,137,104,${fillAlpha})`;

                ctx.beginPath();
                ctx.moveTo(len * 0.6, 0);             // tip
                ctx.lineTo(-len * 0.4, -widthHalf);   // back top
                ctx.lineTo(-len * 0.2, 0);            // inner back
                ctx.lineTo(-len * 0.4, widthHalf);    // back bottom
                ctx.closePath();
                ctx.fill();
                ctx.restore();
        }
}

function init() {
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push(new Particle());
        }
}

function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                        const dx = particles[i].x - particles[j].x;
                        const dy = particles[i].y - particles[j].y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < CONNECTION_DISTANCE) {
                                const opacity = 1 - dist / CONNECTION_DISTANCE;
                                ctx.strokeStyle = `rgba(176,137,104,${opacity * 0.35})`;
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                ctx.moveTo(particles[i].x, particles[i].y);
                                ctx.lineTo(particles[j].x, particles[j].y);
                                ctx.stroke();
                        }
                }
        }
}

function drawCursorGlow() {
        if (mouse.x === null) return;
        const r = 28 + mouse.speed * 0.8;
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
        grad.addColorStop(0,   'rgba(176,137,104,0.38)');
        grad.addColorStop(0.5, 'rgba(176,137,104,0.12)');
        grad.addColorStop(1,   'rgba(176,137,104,0)');
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
}

function drawRipples() {
        for (let i = ripples.length - 1; i >= 0; i--) {
                const rp = ripples[i];
                rp.r += 5;
                rp.alpha -= 0.022;
                if (rp.alpha <= 0) { ripples.splice(i, 1); continue; }
                ctx.beginPath();
                ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(176,137,104,${rp.alpha})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
        }
}

function animate() {
        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        drawCursorGlow();
        drawRipples();
        drawConnections();

        for (const p of particles) {
                p.update();
                p.draw();
        }

        ctx.restore();

        requestAnimationFrame(animate);
}

init();
animate();
