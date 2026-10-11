// One real Seeker player plus 56 explicitly simulated players for a video rehearsal.
// The Seeker answers A ten times. Each simulated player either votes for a
// minority option on their exit question or abstains on the last question.
const exits = [
  [6, 4, 3], // Question 1: 44 A, 6 B, 4 C, 3 D
  [2, 5, 3], // Question 2: 34 A, 2 B, 5 C, 3 D
  [3, 2, 3], // Question 3: 26 A, 3 B, 2 C, 3 D
  [2, 3, 2], // Question 4: 19 A, 2 B, 3 C, 2 D
  [2, 2, 2], // Question 5: 13 A, 2 B, 2 C, 2 D
  [1, 2, 1], // Question 6: 9 A, 1 B, 2 C, 1 D
  [1, 1, 1], // Question 7: 6 A, 1 B, 1 C, 1 D
  [1, 1, 0], // Question 8: 4 A, 1 B, 1 C
  [1, 1, 0], // Question 9: 2 A, 1 B, 1 C
];

const cast = [];
for (let question = 0; question < exits.length; question++) {
  for (let option = 1; option <= 3; option++) {
    for (let count = 0; count < exits[question][option - 1]; count++) {
      cast.push({ exitQuestion: question, minorityChoice: option });
    }
  }
}
cast.push({ exitQuestion: 9, minorityChoice: null });
if (cast.length !== 56) throw new Error('The video cast must have exactly 56 simulated players.');

function castChoice(player, question) {
  if (!Number.isInteger(player) || player < 0 || player >= cast.length ||
      !Number.isInteger(question) || question < 0 || question >= 10) {
    throw new Error('Invalid video cast player or question.');
  }
  if (question > cast[player].exitQuestion) return null;
  return question === cast[player].exitQuestion ? cast[player].minorityChoice : 0;
}

module.exports = { castChoice, castSize: cast.length };
