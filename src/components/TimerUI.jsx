import React, { useState, useEffect } from "react";
import { useStackmatTimer } from "../hooks/useStackmatTimer";
import { generateScramble } from "../utils/scramble";
import { formatTime } from "../utils/formatTime";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  where
} from "firebase/firestore";
import { LogOut, Trophy, Trash2, RefreshCw, Clock, Copy, Check, AlertTriangle, Zap, Save } from "lucide-react";

export default function TimerUI({ user, auth }) {
  const { timerState, time, resetTimer, startHolding, releaseHolding } = useStackmatTimer();

  const [scramble, setScramble] = useState("");
  const [personalBest, setPersonalBest] = useState(null);
  const [diffMsg, setDiffMsg] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userHistory, setUserHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    setScramble(generateScramble());
    fetchPersonalBest();

    const qRank = query(collection(db, "users"), orderBy("personalBest", "asc"), limit(10));
    const unsubRank = onSnapshot(qRank, (snapshot) => {
      const rankingData = [];
      snapshot.forEach((doc) => {
        if (doc.data().personalBest) rankingData.push(doc.data());
      });
      setLeaderboard(rankingData);
    });

    const qHistory = query(collection(db, "solves"), where("uid", "==", user.uid));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const historyData = [];
      snapshot.forEach((doc) => {
        historyData.push({ id: doc.id, ...doc.data() });
      });
      
      historyData.sort((a, b) => {
        const timeA = a.date?.toMillis?.() || Date.now();
        const timeB = b.date?.toMillis?.() || Date.now();
        return timeB - timeA;
      });
      
      setUserHistory(historyData.slice(0, 20));
    });

    return () => {
      unsubRank();
      unsubHistory();
    };
  }, [user]);

  const fetchPersonalBest = async () => {
    if (!user?.uid) return;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().personalBest !== undefined) {
      setPersonalBest(snap.data().personalBest);
    }
  };

  useEffect(() => {
    if (timerState === "stopped") {
      if (personalBest !== null) {
        const diff = time - personalBest;
        setDiffMsg((diff > 0 ? "+" : "") + (diff / 1000).toFixed(2));
      } else {
        setDiffMsg("Novo PB!");
      }
    } else {
      setDiffMsg(null);
    }
  }, [timerState, time, personalBest]);

  const handleSave = async () => {
    try {
      if (!user?.uid) return;
      const currentScramble = scramble;

      await addDoc(collection(db, "solves"), {
        uid: user.uid,
        displayName: user.displayName || "Cubista",
        time: time,
        scramble: currentScramble,
        isDNF: false,
        date: serverTimestamp(),
      });

      if (personalBest === null || time < personalBest) {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName: user.displayName || "Cubista",
          personalBest: time,
        }, { merge: true });
        setPersonalBest(time);
      }
    } catch (e) {
      console.error("Erro ao salvar:", e);
    }
    resetAndNext();
  };

  const handleDNF = async () => {
    try {
      if (!user?.uid) return;
      const currentScramble = scramble;

      await addDoc(collection(db, "solves"), {
        uid: user.uid,
        displayName: user.displayName || "Cubista",
        time: time,
        scramble: currentScramble,
        isDNF: true,
        date: serverTimestamp(),
      });
    } catch (e) {
      console.error("Erro ao salvar DNF:", e);
    }
    resetAndNext();
  };

  const handleDeleteSolve = async (solveId, solveTime, isSolveDNF) => {
    if (!confirm("Deseja apagar permanentemente esta resolução do seu histórico?")) return;

    setUserHistory((prev) => prev.filter((s) => s.id !== solveId));

    try {
      await deleteDoc(doc(db, "solves", solveId));

      if (!isSolveDNF && solveTime === personalBest) {
        const remaining = userHistory.filter((s) => s.id !== solveId && !s.isDNF);
        if (remaining.length === 0) {
          setPersonalBest(null);
          await setDoc(doc(db, "users", user.uid), { personalBest: null }, { merge: true });
        } else {
          const newBest = Math.min(...remaining.map((s) => s.time));
          setPersonalBest(newBest);
          await setDoc(doc(db, "users", user.uid), { personalBest: newBest }, { merge: true });
        }
      }
    } catch (e) {
      console.error("Erro ao deletar:", e);
    }
  };

  const resetAndNext = () => {
    setScramble(generateScramble());
    resetTimer();
  };

  const copyScrambleToClipboard = (scrambleText, id) => {
    navigator.clipboard.writeText(scrambleText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Funções de Toque na Tela
  const handleTouchZoneStart = (e) => { e.preventDefault(); startHolding(); };
  const handleTouchZoneEnd = (e) => { e.preventDefault(); releaseHolding(); };

  let timerColor = "text-zinc-100";
  let timerBg = "bg-zinc-900/50 border-zinc-800";

  if (timerState === "ready") {
    timerColor = "text-emerald-400 font-bold";
    timerBg = "bg-emerald-950/20 border-emerald-500/50";
  } else if (timerState === "running") {
    timerColor = "text-cyan-400 font-medium";
    timerBg = "bg-zinc-950 border-zinc-900 shadow-inner";
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 md:p-6 font-sans select-none">
      
      <header className="w-full flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl">
          <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold block">Seu Recorde</span>
          <span className="text-lg font-mono font-black text-amber-400">{personalBest ? formatTime(personalBest) : "--:--"}</span>
        </div>
        <h1 className="text-sm font-black tracking-widest text-zinc-500 uppercase hidden md:block">🏆 CUBO ARENA</h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold block">Competidor</span>
            <span className="text-sm font-bold text-zinc-200">{user?.displayName || "Jogador"}</span>
          </div>
          <button onClick={() => auth.signOut()} className="h-9 w-9 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"><LogOut size={15} /></button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-6 max-w-7xl w-full mx-auto items-stretch">
        
        <section className={`lg:col-span-4 flex flex-col gap-4 transition-all duration-200 ${timerState === "running" ? "opacity-0 blur-md pointer-events-none" : "opacity-100"}`}>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg flex-1">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 mb-3">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-300">Ranking entre Amigos</h2>
            </div>
            <div className="space-y-1.5 overflow-y-auto max-h-[180px] pr-1">
              {leaderboard.map((player, idx) => (
                <div key={player.uid} className={`flex items-center justify-between p-2 rounded-xl border text-xs ${player.uid === user?.uid ? "bg-amber-500/10 border-amber-500/30" : "bg-zinc-950 border-zinc-800/60"}`}>
                  <span className="font-bold text-zinc-400 w-5">{idx + 1}°</span>
                  <span className="flex-1 font-semibold text-zinc-200 truncate pr-2">{player.displayName}</span>
                  <span className="font-mono font-bold text-zinc-100">{formatTime(player.personalBest)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg flex-1">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 mb-3">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-300">Suas Últimas Soluções</h2>
            </div>
            <div className="space-y-1.5 overflow-y-auto max-h-[180px] pr-1">
              {userHistory.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-xs">Nenhum tempo gravado no banco.</div>
              ) : (
                userHistory.map((solve, idx) => (
                  <div key={solve.id} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800/60 rounded-xl text-xs gap-3">
                    <span className="text-zinc-500 font-mono">#{userHistory.length - idx}</span>
                    <span className={`font-mono font-bold flex-1 ${solve.isDNF ? "text-red-500 line-through" : "text-zinc-200"}`}>
                      {solve.isDNF ? "DNF" : formatTime(solve.time)}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {solve.scramble && (
                        <button 
                          onClick={() => copyScrambleToClipboard(solve.scramble, solve.id)}
                          className="text-zinc-500 hover:text-yellow-400 p-1 transition-colors cursor-pointer"
                          title="Copiar embaralhamento oficial"
                        >
                          {copiedId === solve.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteSolve(solve.id, solve.time, solve.isDNF)} 
                        className="text-zinc-500 hover:text-red-500 p-1 transition-colors cursor-pointer" 
                        title="Deletar este tempo permanentemente"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="lg:col-span-8 flex flex-col gap-6 justify-between items-center min-h-[460px]">
          
          <div className={`w-full transition-all duration-300 transform ${timerState === "running" ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold block mb-1.5">Scramble Oficial (3x3x3)</span>
              <p className="text-base md:text-lg font-mono font-black tracking-wide leading-relaxed text-yellow-400 bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 select-all text-center">{scramble}</p>
              <button onClick={() => setScramble(generateScramble())} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-400 hover:text-yellow-400 transition-colors cursor-pointer"><RefreshCw size={12} /><span>Mudar Embaralhamento</span></button>
            </div>
          </div>

          {/* ÁREA DE CLIQUE E CRONÔMETRO */}
          <div
            onMouseDown={handleTouchZoneStart}
            onMouseUp={handleTouchZoneEnd}
            onTouchStart={handleTouchZoneStart}
            onTouchEnd={handleTouchZoneEnd}
            className={`w-full flex-1 flex flex-col items-center justify-center p-8 border rounded-3xl cursor-pointer transition-all duration-150 relative overflow-hidden ${timerBg}`}
            style={{ touchAction: "none" }}
          >
            <span className={`absolute top-4 text-[9px] font-black tracking-widest uppercase text-center ${timerColor}`}>
              {timerState === "ready" && "SOLTE PARA COMEÇAR!"}
              {timerState === "idle" && "SEGURE ESPAÇO OU CLIQUE NA TELA PARA ARMAR"}
              {timerState === "running" && "RESOLVENDO..."}
              {timerState === "stopped" && "TEMPO PARADO! ESCOLHA ABAIXO:"}
            </span>

            <div className="text-center relative pointer-events-none">
              <div className={`font-mono text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] font-black tracking-tight tabular-nums ${timerColor}`}>
                {/* Mantém em 0.00 enquanto resolve para não gerar ansiedade */}
                {timerState === "running" ? "0.00" : formatTime(time || 0)}
              </div>
              {timerState === "stopped" && diffMsg && (
                <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs font-bold tracking-wider uppercase bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg ${diffMsg.startsWith("+") ? "text-red-400" : "text-emerald-400"}`}>
                  {diffMsg === "Novo PB!" ? diffMsg : `Comparativo: ${diffMsg}s`}
                </div>
              )}
            </div>
          </div>

          <div className="w-full flex items-center justify-center min-h-[50px]">
            {timerState === "stopped" && (
              <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={handleSave} 
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/20"
                >
                  <Save className="w-4 h-4" /> Salvar Tempo
                </button>
                <button 
                  onClick={handleDNF} 
                  className="px-8 py-3 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-xl font-bold uppercase text-xs tracking-wider transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" /> Marcar como DNF
                </button>
                <button onClick={() => { setDiffMsg(null); resetTimer(); setScramble(generateScramble()); }} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold uppercase text-xs tracking-wider cursor-pointer transition-colors hover:text-white">
                  Descartar
                </button>
              </div>
            )}
            {timerState === "idle" && <div className="text-center text-xs tracking-wider text-zinc-500 font-bold uppercase"><span className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300 mr-2">ESPAÇO</span>Segure para armar • Solte para rodar</div>}
            {timerState === "running" && <div className="text-cyan-400 font-black text-xs tracking-widest animate-pulse flex items-center gap-2"><Zap className="w-4 h-4" /> TOQUE EM QUALQUER TECLA OU NA TELA PARA PARAR</div>}
          </div>
        </section>
      </main>
    </div>
  );
}