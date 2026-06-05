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

  // Integração avançada com histórico offline local
  const [copied, setCopied] = useState(false);
  const [solvesHistory, setSolvesHistory] = useState([]);
  const [firestoreStatus, setFirestoreStatus] = useState("synced");

  const mainContainerRef = useRef(null);

  // Inicializa o Scramble e o Personal Best
  useEffect(() => {
    setScramble(generateScramble());
    fetchPersonalBest();
    loadLocalSolves();
  }, [user]);

  // Carrega histórico de resoluções do localStorage
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

  // Salva histórico de resoluções no localStorage
  const saveLocalSolves = (updatedSolves) => {
    setSolvesHistory(updatedSolves);
    const key = `cubes_solves_${user?.uid || "guest"}`;
    localStorage.setItem(key, JSON.stringify(updatedSolves));
  };

  // Busca o Personal Best no Firestore com fallback para LocalStorage
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

  // Calcula comparativos quando o cronômetro para
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

  // Grava a resolução no Cloud Firestore e atualiza o PB
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

  // Cálculos Avançados do Cubo Mágico (Ao5 e Ao12)
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

  // Estados Visuais Dinâmicos das Classes do Tailwind
  let timerColorClass = "text-slate-100 drop-shadow-[0_0_10px_rgba(255,255,255,0.05)]";
  let outerBorderColorClass = "border-slate-800/40";

  if (timerState === "holding") {
    timerColorClass = "text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.4)] scale-[1.01] transition-all duration-100";
    outerBorderColorClass = "border-rose-900/60 shadow-[inset_0_0_20px_rgba(244,63,94,0.08)] bg-rose-950/5";
  } else if (timerState === "ready") {
    timerColorClass = "text-green-400 scale-102 transition-all duration-100";
    outerBorderColorClass = "border-emerald-600/80 shadow-[0_0_25px_rgba(52,211,153,0.15)] bg-emerald-950/5";
  } else if (timerState === "running") {
    timerColorClass = "text-cyan-400 drop-shadow-[0_0_25px_rgba(34,211,238,0.5)]";
    outerBorderColorClass = "border-cyan-500/20";
  }

  let diffColorClass = "text-slate-400";
  if (diffMsg && diffMsg.startsWith("-")) {
    diffColorClass = "text-green-400 animate-bounce";
  } else if (diffMsg && diffMsg.startsWith("+")) {
    diffColorClass = "text-rose-400";
  } else if (diffMsg === "Novo PB!") {
    diffColorClass = "text-amber-400 animate-pulse font-extrabold";
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
    <div ref={mainContainerRef} className="min-h-screen bg-[#050505] text-slate-100 flex flex-col justify-between p-4 md:p-6 lg:p-8 transition-all duration-300 relative overflow-hidden font-mono select-none">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-10" />

      {/* HEADER BAR */}
      <header className="relative z-10 w-full flex flex-row items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="bg-neutral-900/50 backdrop-blur-md px-5 py-2.5 rounded-tr-xl rounded-bl-xl border border-white/5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-0.5 font-bold">Personal Best</div>
          <div className="text-xl font-extrabold text-white flex items-baseline gap-2">
            <span>{personalBest ? formatTime(personalBest) : "--:--"}</span>
            <span className="text-[10px] text-yellow-500 font-bold">PB</span>
          </div>
        </div>

        <div className="hidden sm:flex transition-opacity opacity-85">
          {firestoreStatus === "synced" ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs">
              <Database className="w-3.5 h-3.5" /> <span className="font-bold tracking-wider uppercase text-[9px]">Sincronizado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs">
              <CloudOff className="w-3.5 h-3.5" /> <span className="font-bold tracking-wider uppercase text-[9px]">Offline (Local)</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-row">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-0.5 font-bold">Competitor</div>
            <div className="text-sm font-bold text-slate-200">{user?.displayName || "Jogador"}</div>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="h-10 w-10 rounded-full border border-slate-800 bg-neutral-900/30 flex items-center justify-center hover:bg-rose-500/25 hover:border-red-500 transition-all cursor-pointer text-slate-400 hover:text-red-400 shadow-md group"
            title="Efetuar Logout"
          >
            <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch my-auto py-6 max-w-7xl w-full mx-auto">
        
        {/* SEÇÃO DA ESQUERDA: ESTATÍSTICAS E HISTÓRICO */}
        <section className={`lg:col-span-4 flex flex-col gap-4 self-stretch justify-between transition-all duration-300 ${timerState === 'running' ? 'opacity-[0.05] blur-[3px] pointer-events-none' : 'opacity-100'}`}>
          <div className="bg-neutral-900/40 backdrop-blur-md rounded-xl p-5 border border-white/5 shadow-inner">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-[0.25em] mb-4 pb-2 border-b border-white/5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" /> Estatísticas
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">PB Single</span>
                <p className="text-sm font-bold text-amber-400">{stats.pbSingle ? formatTime(stats.pbSingle) : "--:--"}</p>
              </div>
              <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Solves</span>
                <p className="text-sm font-bold text-slate-300">{solvesHistory.length}</p>
              </div>
              <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ao5</span>
                <p className="text-sm font-bold text-yellow-400">{stats.ao5 ? formatTime(stats.ao5) : "--:--"}</p>
              </div>
              <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ao12</span>
                <p className="text-sm font-bold text-slate-300">{stats.ao12 ? formatTime(stats.ao12) : "--:--"}</p>
              </div>
            </div>
            <div className="mt-4 text-center bg-black/60 rounded-xl p-3 border border-white/5">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-0.5">Sessão Média</span>
              <p className="text-lg font-bold text-cyan-400 leading-tight">{stats.avg ? formatTime(stats.avg) : "--"}</p>
            </div>
          </div>

          <div className="bg-neutral-900/40 backdrop-blur-md rounded-xl p-5 flex-1 flex flex-col max-h-[300px] lg:max-h-[340px] border border-white/5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-[0.25em] flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" /> Resoluções
              </h3>
              {solvesHistory.length > 0 && (
                <button onClick={handleClearAllHistory} className="text-slate-500 hover:text-rose-400 transition p-1.5 hover:bg-rose-950/20 rounded-lg border border-slate-800">
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-2 text-xs">
              {solvesHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-center">
                  <p className="font-semibold text-xs tracking-wider uppercase">Nenhum tempo</p>
                  <p className="text-[10px] mt-1 text-slate-700">Inicie soltando a barra de espaço</p>
                </div>
              ) : (
                solvesHistory.map((solve, idx) => {
                  const solveIndex = solvesHistory.length - idx;
                  const isPB = solve.time === personalBest;
                  return (
                    <div key={solve.id} className={`flex items-center justify-between p-2.5 rounded-lg border group hover:bg-white/5 transition-all duration-200 ${isPB ? "bg-amber-500/5 border-amber-500/30 text-amber-300" : "bg-white/[0.02] border-white/5 text-slate-400"}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-600 font-bold w-6 text-right">#{solveIndex}</span>
                        <span className={`font-bold font-mono text-sm ${isPB ? "text-amber-400" : "text-slate-200"}`}>{formatTime(solve.time)}</span>
                        {isPB && <span className="text-[8px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1 py-0.2 rounded font-bold uppercase tracking-wider">PB!</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="hidden xl:inline text-[9px] font-mono text-slate-500 max-w-[100px] truncate" title={solve.scramble}>{solve.scramble}</span>
                        <button onClick={() => handleDeleteSolve(solve.id, solve.time)} className="opacity-0 group-hover:opacity-100 transition duration-150 p-1 hover:bg-rose-950/35 hover:text-rose-400 rounded text-slate-500">
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

        {/* SEÇÃO DA DIREITA: EMBARALHAMENTO E CRONÔMETRO */}
        <section className="lg:col-span-8 flex flex-col gap-6 justify-between items-center relative min-h-[450px] lg:min-h-full">
          <div className={`w-full transition-all duration-300 transform ${timerState === "running" ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}>
            <div className="relative overflow-hidden bg-neutral-900/40 backdrop-blur-md border border-white/5 rounded-xl p-5 shadow-xl">
              <div className="text-[10px] uppercase tracking-[0.4em] text-yellow-500/50 mb-3.5 font-bold text-center">Official Scramble (3x3x3)</div>
              <p className="text-lg md:text-xl lg:text-2xl font-bold tracking-[0.14em] leading-relaxed text-yellow-400 text-center select-text max-w-2xl mx-auto py-2">{scramble}</p>
              <div className="flex gap-2 justify-center mt-3">
                <button onClick={copyToClipboard} className="flex items-center gap-1.5 px-3 py-1 bg-neutral-950 border border-white/5 rounded-lg text-[10px] text-slate-400 hover:text-white hover:bg-neutral-800 transition">
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  <span>{copied ? "Copiado" : "Copiar"}</span>
                </button>
                <button onClick={() => setScramble(generateScramble())} className="flex items-center gap-1.5 px-3 py-1 bg-neutral-950 border border-white/5 rounded-lg text-[10px] text-slate-400 hover:text-yellow-400 hover:border-yellow-500/30 hover:bg-neutral-800 transition">
                  <RefreshCw size={12} />
                  <span>Gerar Outro</span>
                </button>
              </div>
            </div>
          </div>

          {/* ÁREA DE TOQUE / CRONÔMETRO CENTRAL */}
          <div
            onMouseDown={timerState === "idle" || timerState === "stopped" ? handleTouchZoneStart : undefined}
            onMouseUp={timerState === "holding" || timerState === "ready" ? handleTouchZoneEnd : undefined}
            onTouchStart={timerState === "idle" || timerState === "stopped" ? handleTouchZoneStart : undefined}
            onTouchEnd={timerState === "holding" || timerState === "ready" ? handleTouchZoneEnd : undefined}
            className={`w-full flex-1 flex flex-col items-center justify-center p-8 border rounded-3xl cursor-pointer transition-all duration-300 relative overflow-hidden ${outerBorderColorClass}`}
            style={{ touchAction: "none" }}
          >
            <div className={`absolute top-4 text-[10px] md:text-xs font-bold tracking-[0.2em] transition-opacity uppercase ${timerColorClass}`}>
              {timerState === "holding" && "MANTENHA PRESSIONADO..."}
              {timerState === "ready" && "SOLTE PARA DISPARAR!"}
              {timerState === "idle" && "SEGURE ESPAÇO OU CLIQUE PARA PREPARAR"}
              {timerState === "stopped" && "CUBAGEM GRAVADA"}
            </div>

            <div className="relative">
              <div className={`transition-all duration-150 select-none leading-none z-10 text-[6.5rem] sm:text-[9rem] md:text-[11rem] lg:text-[12rem] font-extrabold tracking-tighter tabular-nums ${timerColorClass}`}>
                {formatTime(time)}
              </div>
              {timerState === "stopped" && diffMsg && (
                <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 text-xl md:text-2xl font-bold tracking-wide ${diffColorClass}`}>
                  {diffMsg !== "Novo PB!" ? `${diffMsg}s` : diffMsg}
                </div>
              )}
            </div>
          </div>

          {/* PAINEL DE BOTÕES PÓS-RESOLUÇÃO */}
          <div className="min-h-[82px] w-full flex items-center justify-center z-20">
            {timerState === "stopped" && (
              <div className="w-full flex flex-col sm:flex-row gap-6 justify-center">
                <button onClick={handleSave} className="group relative px-10 py-4 bg-green-500/10 border border-green-500/40 rounded-xl transition-all hover:bg-green-600 hover:scale-105 flex items-center justify-center gap-2 cursor-pointer">
                  <span className="text-lg font-bold uppercase tracking-widest text-green-400 group-hover:text-white flex items-center gap-2">
                    <Check className="w-5 h-5" /> Salvar Resolução
                  </span>
                </button>
                <button onClick={handleDNF} className="group relative px-10 py-4 bg-red-500/10 border border-red-500/40 rounded-xl transition-all hover:bg-red-600 hover:scale-105 flex items-center justify-center gap-2 cursor-pointer">
                  <span className="text-lg font-bold uppercase tracking-widest text-red-400 group-hover:text-white flex items-center gap-2">
                    <CloudOff className="w-5 h-5" /> Desconsiderar (DNF)
                  </span>
                </button>
              </div>
            )}

            {timerState === "idle" && (
              <div className="text-center opacity-60 flex items-center gap-2 justify-center py-2.5 text-xs tracking-wide text-slate-400">
                <span className="px-2 py-0.5 bg-slate-800 border border-white/10 rounded uppercase font-bold text-[10px]">Espaço</span>
                <span>Segure para inspecionar • Solte para iniciar</span>
              </div>
            )}

            {timerState === "running" && (
              <div className="text-center font-bold text-cyan-400 text-xs tracking-wider animate-pulse flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" /> PRESSIONE QUALQUER TECLA OU CLIQUE PARA PARAR
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER BAR */}
      <footer className="relative z-10 w-full flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
        <p>ChronoCube Systems © 2026</p>
        <div className="flex gap-4">
          <span>Engine Status: Active</span>
          <span>Sync: Cloud Backup</span>
        </div>
      </footer>
    </div>
  );
}