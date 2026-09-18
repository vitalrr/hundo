import type { Account } from './useAuthorization';
import type { SignInPayload } from '@solana-mobile/mobile-wallet-adapter-protocol';
import type { Transaction, VersionedTransaction } from '@solana/web3.js';
const nativeOnly = async (): Promise<never> => { throw new Error('Подключение кошелька доступно в Android-приложении hundo. Здесь можно проверить демораунд.'); };
export function useMobileWallet() {
 return { connect: ():Promise<Account>=>nativeOnly(), signIn:(_payload:SignInPayload):Promise<Account>=>nativeOnly(), disconnect:():Promise<void>=>nativeOnly(), signMessage:(_message:Uint8Array):Promise<Uint8Array>=>nativeOnly(), signAndSendTransaction:(_tx:Transaction|VersionedTransaction,_slot:number):Promise<string>=>nativeOnly() };
}
