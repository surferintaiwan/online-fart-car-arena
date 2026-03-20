/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import NameEntry from './components/NameEntry';
import Game from './components/Game';

export default function App() {
  const [playerName, setPlayerName] = useState<string | null>(null);

  if (!playerName) {
    return <NameEntry onJoin={setPlayerName} />;
  }

  return <Game name={playerName} />;
}

