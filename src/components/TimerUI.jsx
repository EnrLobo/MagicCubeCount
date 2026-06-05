import React, { useState, useEffect } from 'react';
import { useStackmatTimer } from '../hooks/useStackmatTimer';
import { generateScramble } from '../utils/scramble';
import { formatTime } from '../utils/formatTime';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { LogOut } from 'lucide-react';

export default function TimerUI({ user, auth }) {
  const { timerState, time, resetTimer } = useStackmatTimer();
  const [scramble, setScramble] = useState('');
  const [personalBest, setPersonalBest] = useState(null);
  const [diffMsg, setDiffMsg] = useState(null);

  // Inicializa PB e Scramble
  useEffect(() => {
    setScramble(generateScramble());
    fetchPersonalBest();
  }, [user]);

  // Exibe a diferença quando o timer para
  useEffect(() => {
    if (timerState === 'stopped') {
      if (personalBest !== null) {
        const diff = time - personalBest;
        const diffFormat = (diff > 0 ? '+' : '') + (diff / 1000).toFixed(2);
        setDiffMsg(diffFormat);
      } else {
        setDiffMsg('Novo PB!');
      }
    } else {
      setDiffMsg(null); // limpa na próxima resolução
    }
  }, [timerState]);

  const fetchPersonalBest = async () => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().personalBest) {
      setPersonalBest(snap.data().personalBest);
    }
  };

  const handleSave = async () => {
    // 1. Salva a resolução
    await addDoc(collection(db, 'solves'), {
      uid: user.uid,
      displayName: user.displayName,
      time: time,
      scramble: scramble,
      date: serverTimestamp()
    });

    // 2. Atualiza PB Global do usuário (se for o melhor tempo)
    if (personalBest === null || time < personalBest) {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: user.displayName,
        personalBest: time
      }, { merge: true });
      setPersonalBest(time);
    }

    resetAndNext();
  };

  const handleDNF = () => {
    resetAndNext(); // Apenas descarta
  };

  const resetAndNext = () => {
    setScramble(generateScramble());
    resetTimer();
  };

  // Cores dinâmicas baseado no estado
  let timerColor = 'text-gray-100';
  if (timerState === 'ready') timerColor = 'text-red-500';
  if (timerState === 'running') timerColor = 'text-green-400';

  let diffColor = 'text-gray-400';
  if (diffMsg && diffMsg.startsWith('-')) diffColor = 'text-green-400';
  if (diffMsg && diffMsg.startsWith('+')) diffColor = 'text-red-400';

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8 font-mono select-none">
      
      {/* Header / Logout */}
      <div className="absolute top-4 right-8 flex items-center gap-4">
        <span className="text-gray-400 text-sm">Competidor: {user.displayName}</span>
        <button onClick={() => auth.signOut()} className="text-gray-500 hover:text-white transition">
          <LogOut size={20} />
        </button>
      </div>

      {/* PB Global do Usuário */}
      <div className="absolute top-4 left-8 text-gray-400 text-sm">
        PB Atual: <strong className="text-white">{personalBest ? formatTime(personalBest) : '--:--'}</strong>
      </div>

      {/* Scramble (Escondido se estiver rodando para não distrair) */}
      <div className={`text-2xl text-center max-w-2xl font-bold tracking-widest text-yellow-400 mb-16 transition-opacity ${timerState === 'running' ? 'opacity-0' : 'opacity-100'}`}>
        {scramble}
      </div>

      {/* Mostrador do Timer */}
      <div className={`text-8xl md:text-9xl font-bold ${timerColor} transition-colors`}>
        {formatTime(time)}
      </div>

      {/* Resultado (Comparativo) */}
      {timerState === 'stopped' && (
        <div className={`text-2xl mt-4 font-bold ${diffColor}`}>
          {diffMsg && diffMsg !== 'Novo PB!' ? `${diffMsg}s` : diffMsg}
        </div>
      )}

      {/* Controles de Salvar / DNF - Aparecem apenas quando o timer para */}
      {timerState === 'stopped' && (
        <div className="mt-10 flex gap-6">
          <button 
            onClick={handleSave}
            className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded text-xl font-bold transition shadow-lg"
          >
            Salvar Tempo
          </button>
          <button 
            onClick={handleDNF}
            className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded text-xl font-bold transition shadow-lg"
          >
            Desconsiderar (DNF)
          </button>
        </div>
      )}

      {/* Dica de Uso */}
      {timerState === 'idle' && (
        <p className="absolute bottom-10 text-gray-500">
          Pressione e segure <kbd className="bg-gray-800 px-2 py-1 rounded">ESPAÇO</kbd> para preparar. Solte para iniciar.
        </p>
      )}
    </div>
  );
}