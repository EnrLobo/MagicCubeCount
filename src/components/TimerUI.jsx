import React, { useState, useEffect, useMemo, useRef } from "react";
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
} from "firebase/firestore";
import {
  LogOut,
  Activity,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Zap,
  Award,
  Database,
  CloudOff,
} from "lucide-react";

export default function TimerUI({ user, auth }) {
  const { timerState, time, resetTimer, startHolding, releaseHolding } =
    useStackmatTimer();

  const [scramble, setScramble] = useState("");
  const [personalBest, setPersonalBest] = useState(null);
  const [diffMsg, setDiffMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [solvesHistory, setSolvesHistory] = useState([]);
  const [firestoreStatus, setFirestoreStatus] = useState("synced");

  const mainContainerRef = useRef(null);

  useEffect(() => {
    setScramble(generateScramble());
    fetchPersonalBest();
    loadLocalSolves();
  }, [user]);

  const loadLocalSolves = () => {
    const key = `cubes_solves_${user?.uid || "guest"}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        setSolvesHistory(JSON.parse(local));
      } catch (e) {
        console.error("Erro ao carregar resoluções locais:", e);
      }
    }
  };

  const saveLocalSolves = (updatedSolves) => {
    setSolvesHistory(updatedSolves);
    const key = `cubes_solves_${user?.uid || "guest"}`;
    localStorage.setItem(key, JSON.stringify(updatedSolves));
  };

  const fetchPersonalBest = async () => {
    try {
      if (!user?.uid) return;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data().personalBest !== undefined) {
        setPersonalBest(snap.data().personalBest);
        setFirestoreStatus("synced");
      } else {
        const localKey = `cubes_pb_${user.uid}`;
        const localPB = localStorage.getItem(localKey);
        if (localPB) setPersonalBest(Number(localPB));
      }
    } catch (e) {
      setFirestoreStatus("offline");
      const localKey = `cubes_pb_${user.uid}`;
      const localPB = localStorage.getItem(localKey);
      if (localPB) setPersonalBest(Number(localPB));
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
    const timestamp = Date.now();
    const newSolve = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      time: time,
      scramble: scramble,
      date: timestamp,
    };

    const updatedHistory = [newSolve, ...solvesHistory];
    saveLocalSolves(updatedHistory);

    try {
      if (user?.uid) {
        await addDoc(collection(db, "solves"), {
          uid: user.uid,
          displayName: user.displayName || "Jogador",
          time: time,
          scramble: scramble,
          date: serverTimestamp(),
        });
        setFirestoreStatus("synced");
      }
    } catch (e) {
      setFirestoreStatus("offline");
    }

    if (personalBest === null || time < personalBest) {
      setPersonalBest(time);
      localStorage.setItem(`cubes_pb_${user?.uid || "guest"}`, time.toString());

      try {
        if (user?.uid) {
          await setDoc(
            doc(db, "users", user.uid),
            {
              uid: user.uid,
              displayName: user.displayName || "Jogador",
              personalBest: time,
            },
            { merge: true }
          );
          setFirestoreStatus("synced");
        }
      } catch (e) {
        setFirestoreStatus("offline");
      }
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

  const handleDeleteSolve = (id, solveTime) => {
    const nextSolves = solvesHistory.filter((s) => s.id !== id);
    saveLocalSolves(nextSolves);

    if (solveTime === personalBest) {
      if (nextSolves.length === 0) {
        setPersonalBest(null);
        localStorage.removeItem(`cubes_pb_${user?.uid || "guest"}`);
      } else {
        const best = Math.min(...nextSolves.map((s) => s.time));
        setPersonalBest(best);
        localStorage.setItem(`cubes_pb_${user?.uid || "guest"}`, best.toString());
      }
    }
  };

  const handleClearAllHistory = () => {
    if (confirm("Deseja realmente limpar seu histórico de resoluções local?")) {
      saveLocalSolves([]);
      setPersonalBest(null);
      localStorage.removeItem(`cubes_pb_${user?.uid || "guest"}`);
    }
  };

  const stats = useMemo(() => {
    if (solvesHistory.length === 0) {
      return { pbSingle: null, ao5: null, ao12: null, avg: null };
    }

    const times = solvesHistory.map((s) => s.time);
    const pbSingle = Math.min(...times);
    const sum = times.reduce((acc, t) => acc + t, 0);
    const avg = Math.floor(sum / times.length);

    let ao5 = null;
    if (solvesHistory.length >= 5) {
      const last5 = times.slice(0, 5);
      const sorted = [...last5].sort((a, b) => a - b);
      const middle3 = sorted.slice(1, 4);
      const middleSum = middle3.reduce((acc, t) => acc + t, 0);
      ao5 = Math.floor(middleSum / 3);
    }

    let ao12 = null;
    if (solvesHistory.length >= 12) {
      const last12 = times.slice(0, 12);
      const sorted = [...last12].sort((a, b) => a - b);
      const middle10 = sorted.slice(1, 11);
      const middle10Sum = middle10.reduce((acc, t) => acc + t, 0);
      ao12 = Math.floor(middle10Sum / 10);
    }

    return { pbSingle, ao5, ao12, avg };
  }, [solvesHistory]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scramble);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Cores de alto contraste e bem legíveis
  let timerColorClass = "text-gray-100";
  let outerBorderColorClass = "border-zinc-800 bg-zinc-900/50";

  if (timerState === "holding") {
    timerColorClass = "text-red-500 font-bold";
    outerBorderColorClass = "border-red-900/50 bg-red-950/10";
  } else if (timerState === "ready") {
    timerColorClass = "text-emerald-400 font-bold";
    outerBorderColorClass = "border-emerald-500/50 bg-emerald-950/20";
  } else if (timerState === "running") {
    timerColorClass = "text-cyan-400 font-medium";
    outerBorderColorClass = "border-zinc-900 bg-zinc-950";
  }

  let diffColorClass = "text-zinc-400";
  if (diffMsg && diffMsg.startsWith("-")) {
    diffColorClass = "text-emerald-400 font-bold";
  } else if (diffMsg && diffMsg.startsWith("+")) {
    diffColorClass = "text-red-400 font-bold";
  } else if (diffMsg === "Novo PB!") {
    diffColorClass = "text-amber-400 font-extrabold";
  }

  const handleTouchZoneStart = (e) => {
    e.preventDefault();
    startHolding();
  };

  const handleTouchZoneEnd = (e) => {
    e.preventDefault();
    releaseHolding();
  };

  return (
    <div ref={mainContainerRef} className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 md:p-6 select-none font-sans">
      
      {/* HEADER */}
      <header className="w-full flex items-center justify-between pb-4 border-b border-zinc-800 relative z-10">
        <div className="bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">Personal Best</div>
          <div className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <span>{personalBest ? formatTime(personalBest) : "--:--"}</span>
            <span className="text-xs text-amber-400 font-bold">PB</span>
          </div>
        </div>

        <div className="hidden sm:flex">
          {firestoreStatus === "synced" ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
              <Database className="w-3.5 h-3.5" /> <span>Nuvem Ativa</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium">
              <CloudOff className="w-3.5 h-3.5" /> <span>Modo Local</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">Competidor</div>
            <div className="text-sm font-bold text-zinc-200">{user?.displayName || "Jogador"}</div>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center hover:bg-red-950 hover:text-red-400 transition-colors cursor-pointer text-zinc-400"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* GRID LAYOUT PRINCIPAL */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch my-auto py-6 max-w-7xl w-full mx-auto relative z-10">
        
        {/* COLUNA ESQUERDA: LISTAS E STATS */}
        <section className={`lg:col-span-4 flex flex-col gap-4 transition-all duration-200 ${timerState === 'running' ? 'opacity-0 blur-sm pointer-events-none' : 'opacity-100'}`}>
          
          {/* PAINEL DE ESTATÍSTICAS */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-md">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3 pb-2 border-b border-zinc-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" /> Estatísticas
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Melhor Tempo</span>
                <p className="text-sm font-bold text-amber-400">{stats.pbSingle ? formatTime(stats.pbSingle) : "--:--"}</p>
              </div>
              <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Total Resoluções</span>
                <p className="text-sm font-bold text-zinc-200">{solvesHistory.length}</p>
              </div>
              <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Média de 5 (Ao5)</span>
                <p className="text-sm font-bold text-zinc-200">{stats.ao5 ? formatTime(stats.ao5) : "--:--"}</p>
              </div>
              <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Média de 12 (Ao12)</span>
                <p className="text-sm font-bold text-zinc-200">{stats.ao12 ? formatTime(stats.ao12) : "--:--"}</p>
              </div>
            </div>
            <div className="mt-2 text-center bg-zinc-950 rounded-lg p-2.5 border border-zinc-800">
              <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Média Completa</span>
              <p className="text-base font-bold text-cyan-400">{stats.avg ? formatTime(stats.avg) : "--:--"}</p>
            </div>
          </div>

          {/* HISTÓRICO DE TEMPOS */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex-1 flex flex-col max-h-[260px] lg:max-h-[320px] shadow-md">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" /> Histórico
              </h3>
              {solvesHistory.length > 0 && (
                <button onClick={handleClearAllHistory} className="text-zinc-500 hover:text-red-400 transition-colors p-1 hover:bg-zinc-950 rounded border border-zinc-800">
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 text-xs custom-scrollbar">
              {solvesHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-center">
                  <p className="text-xs font-medium uppercase tracking-wider">Histórico Vazio</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Complete sua primeira cubagem!</p>
                </div>
              ) : (
                solvesHistory.map((solve, idx) => {
                  const solveIndex = solvesHistory.length - idx;
                  const isPB = solve.time === personalBest;
                  return (
                    <div key={solve.id} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${isPB ? "bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold" : "bg-zinc-950 border-zinc-800/60 text-zinc-300"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-600 font-mono w-6 text-right">#{solveIndex}</span>
                        <span className={`font-mono text-sm ${isPB ? "text-amber-400" : "text-zinc-100"}`}>{formatTime(solve.time)}</span>
                        {isPB && <span className="text-[8px] bg-amber-500/20 border border-amber-500/40 text-amber-400 px-1 rounded font-bold uppercase">PB</span>}
                      </div>
                      <div className="flex items-center gap-2 group">
                        <span className="hidden xl:inline text-[9px] font-mono text-zinc-500 max-w-[120px] truncate" title={solve.scramble}>{solve.scramble}</span>
                        <button onClick={() => handleDeleteSolve(solve.id, solve.time)} className="text-zinc-500 hover:text-red-400 p-0.5 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: SCRAMBLE E CRONÔMETRO CENTRAL */}
        <section className="lg:col-span-8 flex flex-col gap-6 justify-between items-center min-h-[440px]">
          
          {/* EMBARALHAMENTO (SCRAMBLE) */}
          <div className={`w-full transition-all duration-200 ${timerState === "running" ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-md text-center">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Embaralhamento Oficial (3x3x3)</div>
              <p className="text-lg md:text-xl font-mono font-bold tracking-wide leading-relaxed text-yellow-400 bg-zinc-950 p-3 rounded-lg border border-zinc-800 select-text select-all">{scramble}</p>
              <div className="flex gap-2 justify-center mt-3">
                <button onClick={copyToClipboard} className="flex items-center gap-1 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-400 hover:text-zinc-100 transition-colors">
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copied ? "Copiado" : "Copiar"}</span>
                </button>
                <button onClick={() => setScramble(generateScramble())} className="flex items-center gap-1 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-400 hover:text-yellow-400 transition-colors">
                  <RefreshCw size={12} />
                  <span>Gerar Novo</span>
                </button>
              </div>
            </div>
          </div>

          {/* CRONÔMETRO PRINCIPAL */}
          <div
            onMouseDown={timerState === "idle" || timerState === "stopped" ? handleTouchZoneStart : undefined}
            onMouseUp={timerState === "holding" || timerState === "ready" ? handleTouchZoneEnd : undefined}
            onTouchStart={timerState === "idle" || timerState === "stopped" ? handleTouchZoneStart : undefined}
            onTouchEnd={timerState === "holding" || timerState === "ready" ? handleTouchZoneEnd : undefined}
            className={`w-full flex-1 flex flex-col items-center justify-center p-8 border rounded-2xl cursor-pointer transition-colors duration-200 select-none ${outerBorderColorClass}`}
            style={{ touchAction: "none" }}
          >
            <div className={`absolute top-4 text-[10px] md:text-xs font-bold tracking-widest uppercase transition-colors ${timerColorClass}`}>
              {timerState === "holding" && "MANTENHA PRESSIONADO..."}
              {timerState === "ready" && "SOLTE PARA INICIAR!"}
              {timerState === "idle" && "SEGURE A BARRA DE ESPAÇO PARA PREPARAR"}
              {timerState === "stopped" && "TEMPO CAPTURADO"}
            </div>

            <div className="text-center relative">
              <div className={`font-mono text-7xl sm:text-8xl md:text-9xl lg:text-[9.5rem] font-bold tracking-tight tabular-nums transition-colors duration-75 ${timerColorClass}`}>
                {formatTime(time)}
              </div>
              {timerState === "stopped" && diffMsg && (
                <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 text-lg md:text-xl font-bold tracking-wide ${diffColorClass}`}>
                  {diffMsg !== "Novo PB!" ? `${diffMsg}s` : diffMsg}
                </div>
              )}
            </div>
          </div>

          {/* BOTÕES DE CONTROLE PÓS-RESOLUÇÃO */}
          <div className="w-full flex items-center justify-center">
            {timerState === "stopped" && (
              <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={handleSave} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-sm tracking-wider transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer shadow-md">
                  <Check className="w-4 h-4" /> Salvar Resolução
                </button>
                <button onClick={handleDNF} className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-zinc-700 rounded-xl font-bold uppercase text-sm tracking-wider transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer shadow-md">
                  <CloudOff className="w-4 h-4" /> Desconsiderar (DNF)
                </button>
              </div>
            )}

            {timerState === "idle" && (
              <div className="text-center text-xs tracking-wider text-zinc-500 font-medium">
                <span className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-bold text-zinc-300 mr-2">ESPAÇO</span>
                Segure para inspecionar • Solte para iniciar o cronômetro
              </div>
            )}

            {timerState === "running" && (
              <div className="text-zinc-400 font-bold text-xs tracking-widest animate-pulse flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" /> CLIQUE OU PRESSIONE QUALQUER TECLA PARA PARAR
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-zinc-900 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
        <p>Speedcubing Pro Timer © 2026</p>
        <div className="flex gap-4">
          <span>Status: Pronto</span>
          <span>Firebase Sync: Ativo</span>
        </div>
      </footer>
    </div>
  );
}