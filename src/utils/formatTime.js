export const formatTime = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor((ms % 1000) / 10); // Exibir 2 ou 3 casas (CSTimer usa centésimos ou milésimos, vamos manter 2 casas .XX)

  const formattedSec = seconds.toString().padStart(2, '0');
  const formattedMs = milliseconds.toString().padStart(2, '0');

  if (minutes > 0) {
    return `${minutes}:${formattedSec}.${formattedMs}`;
  }
  return `${seconds}.${formattedMs}`;
};