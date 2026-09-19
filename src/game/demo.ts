import type { Question } from './rules';

// Synthetic fixtures, never presented as historical player data.
export const demoQuestions: Question[] = [
  { id: '1', text: 'What do you tell yourself before aping in?', options: ['I did my research', 'Just a little', 'I’m early this time', 'It’s an investment'] },
  { id: '2', text: 'The chart dumps. First message in the chat?', options: ['Buying the dip', 'Devs, where are you?', 'Healthy correction', 'I’m out'] },
  { id: '3', text: 'Who’s easiest to blame for a loss?', options: ['Whales', 'An influencer', 'Myself', 'Mercury retrograde'] },
  { id: '4', text: 'What’s worst to miss?', options: ['Airdrop', 'The perfect entry', 'Taking profit', 'A big announcement'] },
  { id: '5', text: 'Your token does a 2×. First thought?', options: ['Take profits', 'Should’ve bought more', 'Just getting started', 'Screenshot time'] },
  { id: '6', text: 'Which tab is always open?', options: ['The chart', 'X', 'Telegram', 'Wallet'] },
  { id: '7', text: 'What does “I’m here long term” mean?', options: ['I believe in the team', 'Missed the exit', 'Forgot my password', 'Waiting for the next cycle'] },
  { id: '8', text: 'Which signal feels most convincing?', options: ['Friends bought in', 'A nice website', 'High volume', 'Nobody knows yet'] },
  { id: '9', text: 'What do you check first in the morning?', options: ['My balance', 'SOL price', 'Notifications', 'The time'] },
  { id: '10', text: 'What matters most in crypto?', options: ['Patience', 'Luck', 'A good group chat', 'Knowing when to exit'] },
];
export const demoCounts = [[32, 48, 13, 7], [44, 12, 30, 14], [36, 29, 25, 10], [41, 28, 24, 7], [18, 46, 26, 10], [20, 24, 45, 11], [15, 59, 4, 22], [34, 8, 27, 31], [32, 39, 21, 8], [24, 19, 16, 41]];
