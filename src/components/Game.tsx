import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface GameProps {
  name: string;
}

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
  fartPower: number;
  stunnedUntil: number;
  isBot?: boolean;
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

export default function Game({ name }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const gameState = useRef({
    players: {} as Record<string, Player>,
    fartClouds: [] as FartCloud[],
    beans: [] as Bean[],
    mapGrid: [] as number[][],
    tileSize: 60,
  });

  const keys = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    space: false,
  });

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join', name);
    });

    newSocket.on('init', (data: { id: string, mapGrid: number[][], tileSize: number, players: Record<string, Player>, fartClouds: FartCloud[], beans: Bean[] }) => {
      setMyId(data.id);
      gameState.current.mapGrid = data.mapGrid;
      gameState.current.tileSize = data.tileSize;
      gameState.current.players = data.players;
      gameState.current.fartClouds = data.fartClouds;
      gameState.current.beans = data.beans;
    });

    newSocket.on('stateUpdate', (data: { players: Record<string, Player> }) => {
      gameState.current.players = data.players;
    });

    newSocket.on('fartSpawned', (cloud: FartCloud) => {
      gameState.current.fartClouds.push(cloud);
    });

    newSocket.on('beanSpawned', (bean: Bean) => {
      gameState.current.beans.push(bean);
    });

    newSocket.on('beanCollected', (data: { beanId: string, playerId: string }) => {
      gameState.current.beans = gameState.current.beans.filter(b => b.id !== data.beanId);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [name]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          keys.current.up = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          keys.current.down = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          keys.current.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          keys.current.right = true;
          break;
        case 'Space':
          keys.current.space = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          keys.current.up = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          keys.current.down = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          keys.current.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          keys.current.right = false;
          break;
        case 'Space':
          keys.current.space = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const interval = setInterval(() => {
      socket.emit('input', keys.current);
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const { players, fartClouds, beans, mapGrid, tileSize } = gameState.current;
      
      // Resize canvas to window
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const me = myId ? players[myId] : null;
      
      const mapWidth = mapGrid[0] ? mapGrid[0].length * tileSize : 0;
      const mapHeight = mapGrid.length * tileSize;

      // Camera setup
      let camX = 0;
      let camY = 0;
      if (me) {
        camX = Math.floor(me.x) - Math.floor(canvas.width / 2);
        camY = Math.floor(me.y) - Math.floor(canvas.height / 2);
      }

      // Clamp camera to map bounds
      camX = Math.max(0, Math.min(mapWidth - canvas.width, camX));
      camY = Math.max(0, Math.min(mapHeight - canvas.height, camY));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(-camX, -camY);

      // Draw Map Background
      ctx.fillStyle = '#fcd34d'; // amber-300 (Road color)
      ctx.fillRect(0, 0, mapWidth, mapHeight);

      // Draw subtle grid dots on the road
      ctx.fillStyle = '#f59e0b'; // amber-500
      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[y].length; x++) {
          if (mapGrid[y][x] === 1) {
            ctx.beginPath();
            ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw Walls with 3D effect
      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[y].length; x++) {
          if (mapGrid[y][x] === 0) {
            // Main wall block
            ctx.fillStyle = '#0284c7'; // sky-600
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            
            // Top highlight
            ctx.fillStyle = '#38bdf8'; // sky-400
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, 6);
            
            // Bottom shadow
            ctx.fillStyle = '#0369a1'; // sky-700
            ctx.fillRect(x * tileSize, y * tileSize + tileSize - 6, tileSize, 6);
            
            // Border
            ctx.strokeStyle = '#0c4a6e'; // sky-900
            ctx.lineWidth = 2;
            ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
        }
      }

      // Draw Fart Clouds
      const now = Date.now();
      gameState.current.fartClouds = fartClouds.filter(cloud => {
        const age = now - cloud.createdAt;
        if (age > 4000) return false;
        
        const opacity = Math.max(0, 1 - age / 4000);
        
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.radius + (age / 100), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(163, 230, 53, ${opacity * 0.7})`; // lime-400
        ctx.fill();
        return true;
      });

      // Draw Beans (Glowing Gems)
      beans.forEach(bean => {
        const bx = Math.floor(bean.x);
        const by = Math.floor(bean.y);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fbbf24'; // amber-400
        ctx.fillStyle = '#f59e0b'; // amber-500
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fef3c7'; // amber-100
        ctx.beginPath();
        ctx.arc(bx - 2, by - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Players
      (Object.values(players) as Player[]).forEach(player => {
        ctx.save();
        
        if (player.isDead) {
          ctx.globalAlpha = 0.3;
        } else if (player.invulnerableUntil > Date.now()) {
          ctx.globalAlpha = Math.floor(Date.now() / 100) % 2 === 0 ? 0.5 : 1;
        }

        ctx.translate(Math.floor(player.x), Math.floor(player.y));
        
        let angle = 0;
        if (player.dir === 'UP') angle = -Math.PI / 2;
        if (player.dir === 'DOWN') angle = Math.PI / 2;
        if (player.dir === 'LEFT') angle = Math.PI;
        if (player.dir === 'RIGHT') angle = 0;
        
        ctx.rotate(angle);

        // Draw Car Body (Rally-X style)
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.roundRect(-16, -12, 32, 24, 6); // Main body with rounded corners
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Roof
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.roundRect(-6, -8, 12, 16, 3);
        ctx.fill();
        
        // Headlights
        ctx.fillStyle = '#fef08a'; // yellow-200
        ctx.beginPath();
        ctx.arc(14, -8, 3, 0, Math.PI * 2);
        ctx.arc(14, 8, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Headlight beams
        ctx.fillStyle = 'rgba(253, 224, 71, 0.2)'; // yellow-300 transparent
        ctx.beginPath();
        ctx.moveTo(16, -8);
        ctx.lineTo(60, -25);
        ctx.lineTo(60, 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(16, 8);
        ctx.lineTo(60, -5);
        ctx.lineTo(60, 25);
        ctx.fill();
        
        // Draw Wheels
        ctx.fillStyle = '#171717'; // neutral-900
        ctx.beginPath();
        ctx.roundRect(-12, -14, 8, 4, 2);
        ctx.roundRect(6, -14, 8, 4, 2);
        ctx.roundRect(-12, 10, 8, 4, 2);
        ctx.roundRect(6, 10, 8, 4, 2);
        ctx.fill();

        // Draw Fart Engine Effect if farting
        if (player.isFarting) {
          ctx.beginPath();
          ctx.moveTo(-16, 0);
          ctx.lineTo(-35, -10);
          ctx.lineTo(-35, 10);
          ctx.fillStyle = '#a3e635'; // lime-400
          ctx.fill();
        }

        ctx.restore();

        // Stunned effect
        if (now < player.stunnedUntil) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('😵', player.x, player.y - 20);
        }

        // Draw Name and Score
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        // Add text shadow for visibility
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(`${player.name} (${player.score})`, player.x, player.y - 30);
        ctx.shadowBlur = 0;
      });

      ctx.restore();

      // UI Overlay
      if (me) {
        // Draw Lives
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.roundRect(20, 20, 120, 40, 12);
        ctx.fill();
        
        ctx.fillStyle = '#ef4444';
        ctx.font = '20px Arial';
        ctx.textAlign = 'left';
        let hearts = '';
        for (let i = 0; i < me.lives; i++) hearts += '❤️';
        ctx.fillText(hearts, 35, 47);

        // Fart Power Panel
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // slate-900
        ctx.beginPath();
        ctx.roundRect(20, canvas.height - 80, 260, 60, 12);
        ctx.fill();
        
        ctx.fillStyle = '#94a3b8'; // slate-400
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('FART POWER', 40, canvas.height - 55);

        // Bar background
        ctx.fillStyle = '#334155'; // slate-700
        ctx.beginPath();
        ctx.roundRect(40, canvas.height - 45, 220, 12, 6);
        ctx.fill();
        
        // Bar fill
        const fartCost = 30; // Match FART_COST
        ctx.fillStyle = me.fartPower >= fartCost ? '#10b981' : '#f43f5e'; // emerald-500 or rose-500
        ctx.beginPath();
        ctx.roundRect(40, canvas.height - 45, (me.fartPower / 100) * 220, 12, 6);
        ctx.fill();

        // Leaderboard Panel
        const sortedPlayers = (Object.values(players) as Player[]).sort((a, b) => b.score - a.score);
        const lbWidth = 220;
        const lbHeight = 50 + sortedPlayers.length * 30;
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.roundRect(canvas.width - lbWidth - 20, 20, lbWidth, lbHeight, 12);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText('🏆 Leaderboard', canvas.width - lbWidth, 50);
        
        ctx.font = 'bold 14px Inter, sans-serif';
        sortedPlayers.forEach((p, i) => {
          ctx.fillStyle = p.id === myId ? '#34d399' : (p.isBot ? '#94a3b8' : '#fff');
          ctx.textAlign = 'left';
          ctx.fillText(`${i + 1}. ${p.name}`, canvas.width - lbWidth, 85 + i * 30);
          ctx.textAlign = 'right';
          ctx.fillText(`${p.score}`, canvas.width - 40, 85 + i * 30);
        });

        if (me.isDead) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 48px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('ELIMINATED', canvas.width / 2, canvas.height / 2);
          ctx.fillStyle = '#fff';
          ctx.font = '24px Inter, sans-serif';
          ctx.fillText('Refresh the page to play again', canvas.width / 2, canvas.height / 2 + 40);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [myId]);

  return (
    <div className="w-full h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
