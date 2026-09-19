import type { Account } from './useAuthorization';
import type { SignInPayload } from '@solana-mobile/mobile-wallet-adapter-protocol';
import type { Transaction, VersionedTransaction } from '@solana/web3.js';
const nativeOnly = async (): Promise<never> => { throw new Error('Connect your wallet in the hundo Android app. You can try the demo here.'); };
export function useMobileWallet() {
 return { connect: ():Promise<Account>=>nativeOnly(), signIn:(_payload:SignInPayload):Promise<Account>=>nativeOnly(), disconnect:():Promise<void>=>nativeOnly(), signMessage:(_message:Uint8Array):Promise<Uint8Array>=>nativeOnly(), signAndSendTransaction:(_tx:Transaction|VersionedTransaction,_slot:number):Promise<string>=>nativeOnly() };
}
