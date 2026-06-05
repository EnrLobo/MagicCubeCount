import { useState, useEffect, useRef } from 'react';

export const useStackmatTimer = () => {
  // states: 'idle', 'ready', 'running', 'stopped'
  const [timerState, setTimerState] = useState('idle');
  const [time, setTime] = useState(0);
  
  const startTimeRef = useRef(0);
  const animationFrameRef = useRef(null);

  const updateTimer = () => {
    setTime(Date.now() - startTimeRef.current);
    animationFrameRef.current = requestAnimationFrame(updateTimer);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return; // Ignora se o usuário segurar o botão pressionado gerando múltiplos eventos
      
      if (timerState === 'idle' && e.code === 'Space') {
        e.preventDefault();
        setTimerState('ready');
        setTime(0);
      } else if (timerState === 'running') {
        e.preventDefault();
        // Para o timer ao pressionar QUALQUER tecla
        cancelAnimationFrame(animationFrameRef.current);
        setTime(Date.now() - startTimeRef.current);
        setTimerState('stopped');
      }
    };

    const handleKeyUp = (e) => {
      if (timerState === 'ready' && e.code === 'Space') {
        e.preventDefault();
        startTimeRef.current = Date.now();
        setTimerState('running');
        animationFrameRef.current = requestAnimationFrame(updateTimer);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [timerState]);

  const resetTimer = () => {
    setTimerState('idle');
    setTime(0);
  };

  return { timerState, time, resetTimer };
};