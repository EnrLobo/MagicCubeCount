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
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { LogOut, Trophy, User, Zap, Check, Trash2, XCircle, RefreshCw } from "lucide-react";

export default function TimerUI({ user, auth }) {
  const { timerState, time, resetTimer, startHolding, releaseHolding } = useStackmatTimer();

  const [scramble, setScramble] = useState("");
  const [personalBest, setPersonalBest] = useState(null);
  const [diffMsg, setDiffMsg] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // Inicializa dados e escuta o ranking em tempo real
  useEffect(() => {
    setScramble(generateScramble());
    fetchPersonalBest();

    // ESCUTA EM TEMPO REAL: Puxa o ranking dos amigos direto do Firestore
    const q = query(collection(db, "users"), orderBy("personalBest", "asc"), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rankingData = [];
      snapshot.forEach((doc) => {
        if (doc.data().personalBest) {
          rankingData.push(doc.data());
        }
      });
      setLeaderboard(rankingData);
    });

    return () => unsubscribe();
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
        const diffFormat = (diff > 0 ? "+" : "") + (diff / 1000).toFixed(2);
        setDiffMsg(diffFormat);
      } else {
        setDiffMsg("Novo PB!");
      }
    } else {
      setDiffMsg(null);
    }
  }, [timerState, time, personalBest]);

  const handleSave = async () => {
    try {
      if (user?.uid) {
        // Salva no histórico de solves geral
        await addDoc(collection(db, "solves"), {
          uid: user.uid,
          displayName: user.displayName || "Cubista",
          time: time,
          scramble: scramble,
          date: serverTimestamp(),
        });

        // Se bater o recorde pessoal ou for o primeiro, atualiza o PB para o Ranking dos amigos verem
        if (personalBest === null || time < personalBest) {
          await setDoc(
            doc(db, "users", user.uid),
            {
              uid: user.uid,
              displayName: user.displayName || "Cubista",
              personalBest: time,
            },
            { merge: true }
          );
          setPersonalBest(time);
        }
      }
    } catch (e) {
      console.error("Erro ao salvar dados no Firebase:", e);
    }
    resetAndNext();
  };

  const handleDNF = () => {
    resetAndNext();
  };

  const resetAndNext = () => {
    setScramble(generateScramble());
    resetTimer();
  };

  // Funções de toque para Mobile/Mouse click na área do timer
  const handleTouchZoneStart = (e) => {
    e.preventDefault();
    startHolding();
  };

  const handleTouchZoneEnd = (e) => {
    e.preventDefault();
    releaseHolding();
  };

  // Definição de estados de cores e estilos dinâmicos
  let timerColor = "text-zinc-100";
  let timerBg = "bg-zinc-900/50 border-zinc-800";

  if (timerState === "holding") {
    timerColor = "text-red-500 font-bold";
    timerBg = "bg-red-950/10 border-red-500/40";
  } else if (timerState === "ready") {
    timerColor = "text-emerald-400 font-bold";
    timerBg = "bg-emerald-950/20 border-emerald-500/50 animate-pulse";
  } else if (timerState === "running") {
    timerColor = "text-cyan-400 font-medium";
    timerBg = "bg-zinc-950 border-transparent shadow-inner";
  }

  let diffColor = "text-zinc-400";
  if (diffMsg && diffMsg.startsWith("-")) diffColor = "text-emerald-400 font-bold";
  if (diffMsg && diffMsg.startsWith("+")) diffColor = "text-red-400 font-bold";
  if (diffMsg === "Novo PB!") diffColor = "text-amber-400 font-extrabold animate-bounce";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 md:p-6 font-sans select-none">
      
      {/* HEADER BAR */}
      <header className="w-full flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold">Seu Melhor Tempo</span>
            <span className="text-lg font-mono font-black text-amber-400">
              {personalBest ? formatTime(personalBest) : "--:--"}
            </span>
          </div>
        </div>

        <h1 className="text-lg font-black tracking-widest text-zinc-400 hidden md:block uppercase">
          🏆 Cubo Arena
        </h1>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold block">Competidor</span>
            <span className="text-sm font-bold text-zinc-200">{user?.displayName || "Jogador"}</span>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="h-10 w-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-950/40 hover:border-red-500/30 transition-all cursor-pointer"
            title="Sair do Sistema"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* CORE GRID */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-6 max-w-7xl w-full mx-auto items-stretch">
        
        {/* LADO ESQUERDO: RANKING DOS AMIGOS (4 Colunas) */}
        <section className={`lg:col-span-4 flex flex-col transition-all duration-300 ${timerState === "running" ? "opacity-0 blur-md pointer-events-none" : "opacity-100"}`}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col h-full shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800 mb-4">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-200">
                Ranking entre Amigos
              </h2>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[380px] pr-1">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  Aguardando tempos dos primeiros competidores...
                </div>
              ) : (
                leaderboard.map((player, idx) => {
                  const isCurrentUser = player.uid === user?.uid;
                  return (
                    <div
                      key={player.uid}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isCurrentUser
                          ? "bg-amber-500/10 border-amber-500/40 shadow-md shadow-amber-950/10"
                          : "bg-zinc-950 border-zinc-800/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-xs font-black w-5 text-center ${
                          idx === 0 ? "text-yellow-400 text-sm" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-zinc-500"
                        }`}>
                          {idx + 1}°
                        </span>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold truncate max-w-[140px] ${isCurrentUser ? "text-amber-300" : "text-zinc-200"}`}>
                            {player.displayName}
                          </span>
                          {isCurrentUser && <span className="text-[8px] uppercase text-amber-400/80 font-black tracking-widest">Você</span>}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-black text-zinc-100 bg-zinc-900 border border-zinc-800/60 px-2.5 py-1 rounded-lg">
                        {formatTime(player.personalBest)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* LADO DIREITO: TIMER E SCRAMBLE CENTRAL (8 Colunas) */}
        <section className="lg:col-span-8 flex flex-col gap-6 justify-between items-center min-h-[460px]">
          
          {/* PAINEL DO SCRAMBLE */}
          <div className={`w-full transition-all duration-300 transform ${timerState === "running" ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-md text-center">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-bold block mb-2">
                Embaralhe o cubo usando os movimentos abaixo:
              </span>
              <p className="text-base md:text-lg font-mono font-black tracking-wide leading-relaxed text-yellow-400 bg-zinc-950 p-4 rounded-xl border border-zinc-800/60 select-all select-text">
                {scramble}
              </p>
              <div className="flex justify-center mt-3">
                <button
                  onClick={() => setScramble(generateScramble())}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-400 hover:text-yellow-400 hover:border-yellow-500/30 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Gerar Próximo Embaralhar</span>
                </button>
              </div>
            </div>
          </div>

          {/* MONITOR DO CRONÔMETRO CENTRAL */}
          <div
            onMouseDown={timerState === "idle" || timerState === "stopped" ? handleTouchZoneStart : undefined}
            onMouseUp={timerState === "holding" || timerState === "ready" ? handleTouchZoneEnd : undefined}
            onTouchStart={timerState === "idle" || timerState === "stopped" ? handleTouchZoneStart : undefined}
            onTouchEnd={timerState === "holding" || timerState === "ready" ? handleTouchZoneEnd : undefined}
            className={`w-full flex-1 flex flex-col items-center justify-center p-8 border rounded-3xl cursor-pointer transition-all duration-150 relative overflow-hidden select-none ${timerBg}`}
            style={{ touchAction: "none" }}
          >
            <div className={`absolute top-4 text-[10px] md:text-xs font-black tracking-widest uppercase transition-colors ${timerColor}`}>
              {timerState === "holding" && "MANTENHA APERTADO..."}
              {timerState === "ready" && "SOLTE O ESPAÇO PARA INICIAR!"}
              {timerState === "idle" && "SEGURE ESPAÇO / CLIQUE NA TELA PARA PREPARAR"}
              {timerState === "stopped" && "CUBAGEM CONCLUÍDA"}
            </div>

            <div className="text-center relative">
              <div className={`font-mono text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] font-extrabold tracking-tight tabular-nums transition-colors ${timerColor}`}>
                {formatTime(time)}
              </div>
              
              {timerState === "stopped" && diffMsg && (
                <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 text-lg md:text-xl font-black tracking-wide bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-xl ${diffColor}`}>
                  {diffMsg !== "Novo PB!" ? `${diffMsg}s` : diffMsg}
                </div>
              )}
            </div>
          </div>

          {/* PAINEL DE BOTÕES DE CORREÇÃO */}
          <div className="w-full flex items-center justify-center min-h-[60px]">
            {timerState === "stopped" && (
              <div className="w-full flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
                <button
                  onClick={handleSave}
                  className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all hover:scale-[1.03] flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/20"
                >
                  <Check className="w-4 h-4" /> Salvar e Atualizar Placar
                </button>
                <button
                  onClick={handleDNF}
                  className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-zinc-700 rounded-xl font-bold uppercase text-xs tracking-wider transition-all hover:scale-[1.03] flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <XCircle className="w-4 h-4" /> Desconsiderar Tempo (DNF)
                </button>
              </div>
            )}

            {timerState === "idle" && (
              <div className="text-center text-xs tracking-wider text-zinc-500 font-bold uppercase flex items-center gap-2 justify-center">
                <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">Espaço</span>
                <span>Pressione para armar • Solte para rodar</span>
              </div>
            )}

            {timerState === "running" && (
              <div className="text-cyan-400 font-black text-xs tracking-widest animate-pulse flex items-center gap-2">
                <Zap className="w-4 h-4 fill-cyan-400/20" /> APERTE QUALQUER TECLA PARA PARAR O TEMPO
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER BAR */}
      <footer className="w-full flex items-center justify-between pt-4 border-t border-zinc-900 text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
        <p>Arena Speedcubing • Competição entre Amigos</p>
        <span>Firebase Cloud Sync Ativo</span>
      </footer>
    </div>
  );
}