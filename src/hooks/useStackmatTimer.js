import { useState, useEffect, useRef } from 'react';

export const useStackmatTimer = () => {
  // states: 'idle', 'holding', 'ready', 'running', 'stopped'
  const [timerState, setTimerState] = useState('idle');
  const [time, setTime] = useState(0);
  
  const startTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const holdingTimeoutRef = useRef(null); // Controla o tempo da luz vermelha para verde

  const updateTimer = () => {
    setTime(Date.now() - startTimeRef.current);
    animationFrameRef.current = requestAnimationFrame(updateTimer);
  };

  // Funções exportadas para o clique na tela (Touch / Mouse)
  const startHolding = () => {
    if (timerState === 'idle' || timerState === 'stopped') {
      setTimerState('holding');
      setTime(0);
      
      // Simula o tempo de 300ms do Stackmat oficial (Vermelho -> Verde)
      holdingTimeoutRef.current = setTimeout(() => {
        setTimerState('ready');
      }, 300);
    } else if (timerState === 'running') {
      stopTimer();
    }
  };

  const releaseHolding = () => {
    if (timerState === 'holding') {
      // Se soltar o espaço/tela antes da luz verde, ele cancela
      clearTimeout(holdingTimeoutRef.current);
      setTimerState('idle');
    } else if (timerState === 'ready') {
      // Se soltar no verde, o cronômetro dispara!
      startTimeRef.current = Date.now();
      setTimerState('running');
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    }
  };

  const stopTimer = () => {
    if (timerState === 'running') {
      cancelAnimationFrame(animationFrameRef.current);
      setTime(Date.now() - startTimeRef.current);
      setTimerState('stopped');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return; // Ignora eventos repetidos de segurar a tecla
      
      if (e.code === 'Space' && (timerState === 'idle' || timerState === 'stopped')) {
        e.preventDefault();
        startHolding();
      } else if (timerState === 'running') {
        e.preventDefault();
        stopTimer();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        releaseHolding();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (holdingTimeoutRef.current) clearTimeout(holdingTimeoutRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [timerState]);

  const resetTimer = () => {
    setTimerState('idle');
    setTime(0);
    if (holdingTimeoutRef.current) clearTimeout(holdingTimeoutRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  return { timerState, time, resetTimer, startHolding, releaseHolding };
};