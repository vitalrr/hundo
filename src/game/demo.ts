import type { Question } from './rules';

// Synthetic fixtures, never presented as historical player data.
export const demoQuestions: Question[] = [
  { id: '1', text: 'If the room could follow one market right now, which would most watch?', options: ['BTC', 'SOL', 'ETH', 'New tokens'] },
  { id: '2', text: 'If SOL falls 10% in a day, what will most players do?', options: ['Buy more', 'Hold', 'Sell some', 'Wait for news'] },
  { id: '3', text: 'What worries the room most this week?', options: ['Price drop', 'Scam links', 'Missing a rally', 'New rules'] },
  { id: '4', text: 'Which signal would most trust before buying?', options: ['Price trend', 'Product users', 'A friend’s pick', 'Big-wallet moves'] },
  { id: '5', text: 'If the market rises fast, what will most do first?', options: ['Take profit', 'Buy more', 'Hold', 'Ask why'] },
  { id: '6', text: 'Where would the room move money after a big gain?', options: ['Stablecoins', 'BTC', 'SOL', 'Cash'] },
  { id: '7', text: 'How long will most wait before their next trade?', options: ['Today', 'This week', 'After a dip', 'No plan'] },
  { id: '8', text: 'What could change the room’s mood fastest?', options: ['Big hack', 'Price breakout', 'New app launch', 'Clear rules'] },
  { id: '9', text: 'What will most expect from SOL next week?', options: ['Rise', 'Fall', 'Stay flat', 'Hard to say'] },
  { id: '10', text: 'Which word fits the room right now?', options: ['Buy', 'Hold', 'Sell', 'Wait'] },
];
export const demoCounts = [[28, 46, 15, 11], [35, 42, 8, 15], [38, 22, 28, 12], [24, 36, 17, 23], [32, 18, 41, 9], [29, 27, 35, 9], [23, 31, 39, 7], [20, 45, 25, 10], [40, 12, 23, 25], [24, 32, 8, 36]];
