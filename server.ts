import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

const PORT = 3000;

const TILE_SIZE = 60;
const GRID_W = 31;
const GRID_H = 31;
const MAP_WIDTH = GRID_W * TILE_SIZE;
const MAP_HEIGHT = GRID_H * TILE_SIZE;

// Generate Maze
const mapGrid: number[][] = [];
for (let y = 0; y < GRID_H; y++) {
  const row = [];
  for (let x = 0; x < GRID_W; x++) {
    if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) {
      row.push(0); // Border
    } else if (x % 3 !== 0 && y % 3 !== 0) {
      row.push(0); // Block
    } else {
      row.push(1); // Road
    }
  }
  mapGrid.push(row);
}

// Randomly open some walls to make it a maze
for (let y = 1; y < GRID_H - 1; y++) {
  for (let x = 1; x < GRID_W - 1; x++) {
    if (mapGrid[y][x] === 0 && Math.random() < 0.25) {
      mapGrid[y][x] = 1;
    }
  }
}

// Ensure center is open for spawning
mapGrid[15][15] = 1;
mapGrid[15][14] = 1;
mapGrid[15][16] = 1;

// Game State
interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  nextDir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null;
  speed: number;
  color: string;
  score: number;
  isFarting: boolean;
  fartPower: number; // 0 to 100
  stunnedUntil: number;
  isBot?: boolean;
  lastAITick?: number;
  lives: number;
  isDead: boolean;
  invulnerableUntil: number;
}

interface FartCloud {
  id: string;
  x: number;
  y: number;
  radius: number;
  createdAt: number;
  ownerId: string;
}

interface Bean {
  id: string;
  x: number;
  y: number;
}

const players: Record<string, Player> = {};
let fartClouds: FartCloud[] = [];
let beans: Bean[] = [];

const MAX_BEANS = 50;
const FART_CLOUD_LIFETIME = 4000; // ms
const BASE_SPEED = 4;
const FART_SPEED = 7;
const FART_COST = 30;
const CAR_SIZE = 30;

function getRandomColor() {
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getTile(x: number, y: number) {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) return 0;
  return mapGrid[ty][tx];
}

function canMove(x: number, y: number, dir: string, speed: number) {
  const half = CAR_SIZE / 2 - 2; // slight tolerance
  let nx = x;
  let ny = y;
  if (dir === 'UP') ny -= speed;
  if (dir === 'DOWN') ny += speed;
  if (dir === 'LEFT') nx -= speed;
  if (dir === 'RIGHT') nx += speed;

  const t1 = getTile(nx - half, ny - half);
  const t2 = getTile(nx + half, ny - half);
  const t3 = getTile(nx - half, ny + half);
  const t4 = getTile(nx + half, ny + half);

  return t1 === 1 && t2 === 1 && t3 === 1 && t4 === 1;
}

function spawnBeans() {
  while (beans.length < MAX_BEANS) {
    let tx = Math.floor(Math.random() * GRID_W);
    let ty = Math.floor(Math.random() * GRID_H);
    if (mapGrid[ty][tx] === 1) {
      beans.push({
        id: Math.random().toString(36).substring(7),
        x: tx * TILE_SIZE + TILE_SIZE / 2,
        y: ty * TILE_SIZE + TILE_SIZE / 2,
      });
    }
  }
}

function spawnBots() {
  const botNames = ['Bot_Alpha', 'Bot_Beta', 'Bot_Gamma', 'Bot_Delta'];
  botNames.forEach((name, i) => {
    const id = 'bot_' + i;
    players[id] = {
      id,
      name,
      x: 15 * TILE_SIZE + TILE_SIZE / 2,
      y: 15 * TILE_SIZE + TILE_SIZE / 2,
      dir: ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)] as any,
      nextDir: null,
      speed: BASE_SPEED,
      color: getRandomColor(),
      score: 0,
      isFarting: false,
      fartPower: 100,
      stunnedUntil: 0,
      isBot: true,
      lastAITick: 0,
      lives: 3,
      isDead: false,
      invulnerableUntil: 0
    };
  });
}

spawnBeans();
spawnBots();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("join", (name: string) => {
      players[socket.id] = {
        id: socket.id,
        name: name.substring(0, 15) || "Anonymous",
        x: 15 * TILE_SIZE + TILE_SIZE / 2,
        y: 15 * TILE_SIZE + TILE_SIZE / 2,
        dir: 'UP',
        nextDir: null,
        speed: BASE_SPEED,
        color: getRandomColor(),
        score: 0,
        isFarting: false,
        fartPower: 100,
        stunnedUntil: 0,
        lives: 3,
        isDead: false,
        invulnerableUntil: 0,
      };
      
      socket.emit("init", {
        id: socket.id,
        mapGrid,
        tileSize: TILE_SIZE,
        players,
        fartClouds,
        beans
      });
      
      socket.broadcast.emit("playerJoined", players[socket.id]);
    });

    socket.on("input", (input: { up: boolean; down: boolean; left: boolean; right: boolean; space: boolean }) => {
      const player = players[socket.id];
      if (!player) return;

      if (input.up) player.nextDir = 'UP';
      else if (input.down) player.nextDir = 'DOWN';
      else if (input.left) player.nextDir = 'LEFT';
      else if (input.right) player.nextDir = 'RIGHT';

      // Fart Boost
      if (input.space && player.fartPower >= FART_COST && !player.isFarting && Date.now() > player.stunnedUntil) {
        player.fartPower -= FART_COST;
        player.isFarting = true;

        // Spawn fart cloud behind player
        let cloudX = player.x;
        let cloudY = player.y;
        if (player.dir === 'UP') cloudY += 30;
        if (player.dir === 'DOWN') cloudY -= 30;
        if (player.dir === 'LEFT') cloudX += 30;
        if (player.dir === 'RIGHT') cloudX -= 30;
        
        const cloud: FartCloud = {
          id: Math.random().toString(36).substring(7),
          x: cloudX,
          y: cloudY,
          radius: 40,
          createdAt: Date.now(),
          ownerId: player.id
        };
        fartClouds.push(cloud);
        io.emit("fartSpawned", cloud);
      } else if (!input.space) {
        player.isFarting = false;
      }
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
      delete players[socket.id];
      io.emit("playerLeft", socket.id);
    });
  });

  // Game Loop
  setInterval(() => {
    const now = Date.now();

    // Check player-bot collisions
    for (const id1 in players) {
      const p1 = players[id1];
      if (p1.isBot || p1.isDead || now < p1.invulnerableUntil) continue;

      for (const id2 in players) {
        const p2 = players[id2];
        if (!p2.isBot || p2.isDead) continue;

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        if (dx * dx + dy * dy < 900) { // 30px radius collision
          p1.lives -= 1;
          p1.invulnerableUntil = now + 2000; // 2 seconds of invulnerability
          if (p1.lives <= 0) {
            p1.isDead = true;
            p1.lives = 0;
          }
          break; // Only take one hit per frame
        }
      }
    }

    // Update players
    for (const id in players) {
      const p = players[id];
      
      if (p.isDead) continue;

      if (now < p.stunnedUntil) {
        p.isFarting = false;
        continue; // Stunned, cannot move
      }

      let currentSpeed = p.isFarting ? FART_SPEED : BASE_SPEED;
      const isBlocked = !canMove(p.x, p.y, p.dir, currentSpeed);

      const tx = Math.floor(p.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const ty = Math.floor(p.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const dx = Math.abs(p.x - tx);
      const dy = Math.abs(p.y - ty);

      // --- BOT AI LOGIC ---
      if (p.isBot && now > (p.lastAITick || 0)) {
        if ((dx <= currentSpeed && dy <= currentSpeed) || isBlocked) {
          p.lastAITick = now + 100;
          const validDirs: ('UP'|'DOWN'|'LEFT'|'RIGHT')[] = [];
          const dirs: ('UP'|'DOWN'|'LEFT'|'RIGHT')[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
          for (const d of dirs) {
            const isOpposite = (p.dir === 'UP' && d === 'DOWN') || (p.dir === 'DOWN' && d === 'UP') || (p.dir === 'LEFT' && d === 'RIGHT') || (p.dir === 'RIGHT' && d === 'LEFT');
            if (isOpposite && !isBlocked) continue; // Only reverse if blocked
            if (canMove(tx, ty, d, currentSpeed)) {
              validDirs.push(d);
            }
          }

          if (validDirs.length > 0) {
            if (validDirs.includes(p.dir) && Math.random() < 0.75 && !isBlocked) {
              p.nextDir = p.dir;
            } else {
              p.nextDir = validDirs[Math.floor(Math.random() * validDirs.length)];
            }
          } else {
            if (p.dir === 'UP') p.nextDir = 'DOWN';
            else if (p.dir === 'DOWN') p.nextDir = 'UP';
            else if (p.dir === 'LEFT') p.nextDir = 'RIGHT';
            else if (p.dir === 'RIGHT') p.nextDir = 'LEFT';
          }
        }

        // Bot Fart Logic
        if (p.fartPower >= FART_COST && Math.random() < 0.02 && !p.isFarting) {
          p.isFarting = true;
          p.fartPower -= FART_COST;
          let cloudX = p.x;
          let cloudY = p.y;
          if (p.dir === 'UP') cloudY += 30;
          if (p.dir === 'DOWN') cloudY -= 30;
          if (p.dir === 'LEFT') cloudX += 30;
          if (p.dir === 'RIGHT') cloudX -= 30;
          const cloud: FartCloud = {
            id: Math.random().toString(36).substring(7),
            x: cloudX, y: cloudY, radius: 40, createdAt: now, ownerId: p.id
          };
          fartClouds.push(cloud);
          io.emit("fartSpawned", cloud);
        } else if (p.isFarting && Math.random() < 0.1) {
          p.isFarting = false;
        }
      }
      // --- END BOT AI LOGIC ---

      // --- MOVEMENT LOGIC ---
      let turned = false;
      
      if (p.nextDir && p.nextDir !== p.dir) {
        const isOpposite = 
          (p.dir === 'UP' && p.nextDir === 'DOWN') ||
          (p.dir === 'DOWN' && p.nextDir === 'UP') ||
          (p.dir === 'LEFT' && p.nextDir === 'RIGHT') ||
          (p.dir === 'RIGHT' && p.nextDir === 'LEFT');
          
        if (isOpposite) {
          p.dir = p.nextDir;
          p.nextDir = null;
          turned = true;
        } else {
          // 90 degree turn
          if (dx <= currentSpeed + 2 && dy <= currentSpeed + 2) {
            const testX = p.nextDir === 'UP' || p.nextDir === 'DOWN' ? tx : p.x;
            const testY = p.nextDir === 'LEFT' || p.nextDir === 'RIGHT' ? ty : p.y;
            
            if (canMove(testX, testY, p.nextDir, currentSpeed)) {
              p.x = testX;
              p.y = testY;
              p.dir = p.nextDir;
              p.nextDir = null;
              turned = true;
            }
          }
          
          // Turn when stuck against a wall
          if (!turned && isBlocked) {
            if (canMove(tx, ty, p.nextDir, currentSpeed)) {
              p.x = tx;
              p.y = ty;
              p.dir = p.nextDir;
              p.nextDir = null;
              turned = true;
            }
          }
        }
      }

      // Move forward
      if (canMove(p.x, p.y, p.dir, currentSpeed)) {
        if (p.dir === 'UP') p.y -= currentSpeed;
        if (p.dir === 'DOWN') p.y += currentSpeed;
        if (p.dir === 'LEFT') p.x -= currentSpeed;
        if (p.dir === 'RIGHT') p.x += currentSpeed;
      }
      // --- END MOVEMENT LOGIC ---

      // Recharge fart power
      if (p.fartPower < 100) {
        p.fartPower += 0.3;
        if (p.fartPower > 100) p.fartPower = 100;
      }

      // Check bean collisions
      for (let i = beans.length - 1; i >= 0; i--) {
        const b = beans[i];
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        if (dx * dx + dy * dy < 900) { // 30px radius
          beans.splice(i, 1);
          p.score += 10;
          p.fartPower = Math.min(100, p.fartPower + 25);
          io.emit("beanCollected", { beanId: b.id, playerId: p.id });
        }
      }

      // Check fart cloud collisions
      for (const cloud of fartClouds) {
        if (cloud.ownerId !== p.id) {
          const dx = p.x - cloud.x;
          const dy = p.y - cloud.y;
          if (dx * dx + dy * dy < cloud.radius * cloud.radius) {
            // Stun player
            p.stunnedUntil = now + 2000;
          }
        }
      }
    }

    // Update fart clouds
    fartClouds = fartClouds.filter(c => now - c.createdAt < FART_CLOUD_LIFETIME);

    // Respawn beans
    if (beans.length < MAX_BEANS && Math.random() < 0.05) {
      let tx = Math.floor(Math.random() * GRID_W);
      let ty = Math.floor(Math.random() * GRID_H);
      if (mapGrid[ty][tx] === 1) {
        const newBean = {
          id: Math.random().toString(36).substring(7),
          x: tx * TILE_SIZE + TILE_SIZE / 2,
          y: ty * TILE_SIZE + TILE_SIZE / 2,
        };
        beans.push(newBean);
        io.emit("beanSpawned", newBean);
      }
    }

    // Broadcast state
    io.emit("stateUpdate", { players });

  }, 1000 / 60); // 60 FPS

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
