import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Wind } from 'lucide-react';

interface NameEntryProps {
  onJoin: (name: string) => void;
}

export default function NameEntry({ onJoin }: NameEntryProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name.trim());
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900 text-white font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-zinc-700"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-emerald-500/20 p-4 rounded-full mb-4">
            <Wind className="w-12 h-12 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center">放屁車大亂鬥</h1>
          <p className="text-zinc-400 mt-2 text-center">Fart Car Arena</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
              輸入你的車手名稱
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={15}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-white placeholder-zinc-500"
              placeholder="例如：放屁大王"
              autoFocus
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            進入遊戲 <Wind className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 text-sm text-zinc-400 bg-zinc-900/50 p-4 rounded-xl border border-zinc-700/50">
          <h3 className="text-zinc-200 font-semibold mb-3 text-center">📖 遊戲規則與操作</h3>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong className="text-emerald-400">移動：</strong> 使用 <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-600">W</kbd> <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-600">A</kbd> <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-600">S</kbd> <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-600">D</kbd> 或 方向鍵來控制車輛。</li>
            <li><strong className="text-amber-400">收集：</strong> 吃掉地上的發光豆子來增加分數與「放屁能量」。</li>
            <li><strong className="text-lime-400">放屁加速：</strong> 能量滿時按下 <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-600">空白鍵</kbd> 噴射加速，並在身後留下毒氣雲！</li>
            <li><strong className="text-rose-400">生存：</strong> 碰到敵人（灰色車輛）會扣除 1 點生命，扣滿 3 次即淘汰！</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
