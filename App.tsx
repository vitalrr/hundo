import './src/polyfills';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HundoApp } from './src/features/HundoApp';
const client = new QueryClient();
export default function App() {
  return <SafeAreaProvider><QueryClientProvider client={client}><HundoApp /></QueryClientProvider></SafeAreaProvider>;
}
