export const generateScramble = () => {
  const moves = ['U', 'D', 'L', 'R', 'F', 'B'];
  const modifiers = ['', "'", '2'];
  const scramble = [];
  let lastMove = -1;
  let beforeLastMove = -1;

  for (let i = 0; i < 20; i++) {
    let randomMove;
    // Evita movimentos no mesmo eixo consecutivamente ou repetidos
    do {
      randomMove = Math.floor(Math.random() * moves.length);
    } while (
      randomMove === lastMove || 
      (randomMove === beforeLastMove && Math.floor(randomMove / 2) === Math.floor(lastMove / 2))
    );

    const randomModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble.push(moves[randomMove] + randomModifier);
    
    beforeLastMove = lastMove;
    lastMove = randomMove;
  }
  
  return scramble.join(' ');
};