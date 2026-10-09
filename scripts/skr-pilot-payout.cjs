#!/usr/bin/env node
// One-time, operator-controlled 1 SKR mainnet pilot prize. Never runs in the app.
// Usage and custody rules: docs/skr-pilot.md.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction,
} = require('@solana/web3.js');

const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const MINT = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const DECIMALS = 6;
const ONE_SKR = 1_000_000n;
const SOL_BUFFER = 1_000_000; // additional 0.001 SOL after rent and fee
const ROUND_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function privateDirectory() {
  const directory = process.env.HUNDO_SKR_TREASURY_DIR;
  if (!directory || !path.isAbsolute(directory)) throw new Error('Set HUNDO_SKR_TREASURY_DIR to an absolute private directory.');
  const repo = path.resolve(__dirname, '..');
  const resolved = path.resolve(directory);
  if (resolved === repo || resolved.startsWith(repo + path.sep)) throw new Error('The treasury must be outside the Git repository.');
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) throw new Error('Treasury directory must be owner-only (mode 700).');
  return resolved;
}

function readPrivateJson(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error('Private file must be owner-only (mode 600).');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function savePrivateJson(file, value) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
}

function treasury(directory) {
  const key = Uint8Array.from(readPrivateJson(path.join(directory, 'treasury.json')));
  if (key.length !== 64) throw new Error('Invalid treasury key length.');
  return Keypair.fromSecretKey(key);
}

function ata(owner) {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), MINT.toBuffer()], ATA_PROGRAM)[0];
}

function readTokenAmount(info, expectedOwner) {
  if (!info) return 0n;
  if (!info.owner.equals(TOKEN_PROGRAM) || info.data.length < 72) throw new Error('Unexpected token account program or length.');
  if (!info.data.subarray(0, 32).equals(MINT.toBuffer())) throw new Error('Token account has the wrong mint.');
  if (!info.data.subarray(32, 64).equals(expectedOwner.toBuffer())) throw new Error('Token account has the wrong wallet owner.');
  return info.data.readBigUInt64LE(64);
}

async function checkedConnection() {
  const endpoint = process.env.HUNDO_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
  if (!endpoint.startsWith('https://')) throw new Error('RPC endpoint must use HTTPS.');
  const connection = new Connection(endpoint, { commitment: 'confirmed', disableRetryOnRateLimit: true });
  if (await connection.getGenesisHash() !== MAINNET_GENESIS) throw new Error('RPC is not Solana Mainnet Beta.');
  const mint = await connection.getAccountInfo(MINT);
  if (!mint || !mint.owner.equals(TOKEN_PROGRAM) || mint.data.length !== 82 || mint.data[44] !== DECIMALS) {
    throw new Error('SKR mint did not match the expected token program and six decimals.');
  }
  return connection;
}

function supabaseCredentials() {
  const url = process.env.HUNDO_SUPABASE_URL;
  const key = process.env.HUNDO_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
    throw new Error('Set HUNDO_SUPABASE_URL and HUNDO_SUPABASE_SERVICE_ROLE_KEY in the local private environment.');
  }
  return { url, key };
}

async function databaseRequest(route, options = {}) {
  const { url, key } = supabaseCredentials();
  const response = await fetch(url + '/rest/v1/' + route, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Supabase verification failed (${response.status}).`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function verifiedSoleFinalist(roundId, wallet) {
  if (!ROUND_ID.test(roundId)) throw new Error('Provide a valid round UUID.');
  await databaseRequest('rpc/hundo_settle', { method: 'POST', body: JSON.stringify({ p_round: roundId }) });
  const rounds = await databaseRequest(`hundo_rounds?select=id,starts_at,is_rehearsal,pot_lamports,settled_through&id=eq.${roundId}`);
  const round = rounds?.[0];
  if (!round || !round.is_rehearsal || String(round.pot_lamports) !== '0' || round.settled_through !== 9) {
    throw new Error('Round must be a finished, zero-SOL rehearsal before the pilot prize can be prepared.');
  }
  if (Date.now() < Date.parse(round.starts_at) + 200_000) throw new Error('Round has not reached its final screen.');
  const finalists = await databaseRequest(`hundo_players?select=wallet,eliminated_at&round_id=eq.${roundId}&eliminated_at=is.null`);
  if (finalists?.length !== 1 || finalists[0].wallet !== wallet.toBase58()) {
    throw new Error('The recipient must be the sole finalist recorded by the game server.');
  }
  return round;
}

async function pilotRecord(roundId) {
  const rows = await databaseRequest(`hundo_skr_pilots?select=round_id,treasury_wallet,mint,amount_raw,status,winner_wallet,signature&round_id=eq.${roundId}`);
  const pilot = rows?.[0];
  if (!pilot || pilot.mint !== MINT.toBase58() || String(pilot.amount_raw) !== ONE_SKR.toString()) {
    throw new Error('This round is not registered as the one-time 1 SKR pilot.');
  }
  return pilot;
}

async function updatePilot(roundId, expectedStatus, fields) {
  const rows = await databaseRequest(`hundo_skr_pilots?round_id=eq.${roundId}&status=eq.${expectedStatus}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
  if (rows?.length !== 1) throw new Error('Pilot status changed concurrently or was not updated.');
  return rows[0];
}

function createAtaInstruction(payer, owner, destination) {
  return new TransactionInstruction({
    programId: ATA_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // idempotent associated token account creation
  });
}

function transferCheckedInstruction(source, destination, authority) {
  const data = Buffer.alloc(10);
  data[0] = 12; // SPL Token TransferChecked
  data.writeBigUInt64LE(ONE_SKR, 1);
  data[9] = DECIMALS;
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

function receiptFile(directory, roundId) { return path.join(directory, `round-${roundId}.json`); }

function validatedSignedBytes(receipt, wallet) {
  if (!receipt.signedTransaction) throw new Error('Signed transaction is not available in the private receipt.');
  const bytes = Buffer.from(receipt.signedTransaction, 'base64');
  const tx = Transaction.from(bytes);
  const recipient = new PublicKey(receipt.recipient);
  if (!tx.verifySignatures() || !tx.feePayer?.equals(wallet.publicKey) || tx.recentBlockhash !== receipt.blockhash.blockhash) {
    throw new Error('Signed transaction has an invalid signer, fee payer, or blockhash.');
  }
  if (!tx.signature || require('bs58').encode(tx.signature) !== receipt.signature) throw new Error('Signed transaction signature differs from the receipt.');
  if (receipt.source !== ata(wallet.publicKey).toBase58() || receipt.destination !== ata(recipient).toBase58()) throw new Error('Receipt token accounts differ from the expected wallets.');
  const transfers = tx.instructions.filter(instruction => instruction.programId.equals(TOKEN_PROGRAM));
  if (transfers.length !== 1 || !transfers[0].data.equals(transferCheckedInstruction(ata(wallet.publicKey), ata(recipient), wallet.publicKey).data)) {
    throw new Error('Signed transaction does not transfer exactly 1 official SKR.');
  }
  const transfer = transfers[0];
  if (transfer.keys[0].pubkey.toBase58() !== receipt.source || !transfer.keys[1].pubkey.equals(MINT) ||
      transfer.keys[2].pubkey.toBase58() !== receipt.destination || !transfer.keys[3].pubkey.equals(wallet.publicKey)) {
    throw new Error('Signed token transfer accounts do not match the receipt.');
  }
  const expectedMemo = `hundo:1-skr-pilot:${receipt.roundId}`;
  const memo = tx.instructions.find(instruction => instruction.programId.equals(MEMO_PROGRAM));
  const ataCreates = tx.instructions.filter(instruction => instruction.programId.equals(ATA_PROGRAM));
  if (!memo || memo.data.toString() !== expectedMemo || ataCreates.length > 1 ||
      tx.instructions.length !== 2 + ataCreates.length ||
      tx.instructions.some(instruction => ![TOKEN_PROGRAM, MEMO_PROGRAM, ATA_PROGRAM].some(program => instruction.programId.equals(program)))) {
    throw new Error('Unexpected instructions in the signed pilot payment.');
  }
  if (ataCreates.length && (ataCreates[0].data.toString('hex') !== '01' ||
      ataCreates[0].keys[0].pubkey.toBase58() !== receipt.treasury ||
      ataCreates[0].keys[1].pubkey.toBase58() !== receipt.destination ||
      ataCreates[0].keys[2].pubkey.toBase58() !== receipt.recipient ||
      !ataCreates[0].keys[3].pubkey.equals(MINT))) throw new Error('Unexpected recipient token-account creation.');
  return bytes;
}

async function status(directory) {
  const wallet = treasury(directory);
  const connection = await checkedConnection();
  const source = ata(wallet.publicKey);
  const [sol, info] = await Promise.all([connection.getBalance(wallet.publicKey), connection.getAccountInfo(source)]);
  const raw = readTokenAmount(info, wallet.publicKey);
  console.log(JSON.stringify({ network: 'mainnet-beta', treasury: wallet.publicKey.toBase58(), skrMint: MINT.toBase58(), skr: Number(raw) / Number(ONE_SKR), sol, fundedForOneSkr: raw >= ONE_SKR && sol > SOL_BUFFER }, null, 2));
}

async function announce(directory, roundId) {
  if (!ROUND_ID.test(roundId)) throw new Error('Provide a valid round UUID.');
  const wallet = treasury(directory);
  const rounds = await databaseRequest(`hundo_rounds?select=id,starts_at,is_rehearsal,pot_lamports&id=eq.${roundId}`);
  const round = rounds?.[0];
  if (!round || !round.is_rehearsal || String(round.pot_lamports) !== '0' || Date.parse(round.starts_at) <= Date.now() + 60_000) {
    throw new Error('Pilot must be a future zero-SOL round with at least one minute before start.');
  }
  const connection = await checkedConnection();
  const [source, sol] = await Promise.all([connection.getAccountInfo(ata(wallet.publicKey)), connection.getBalance(wallet.publicKey)]);
  const rent = await connection.getMinimumBalanceForRentExemption(165);
  if (readTokenAmount(source, wallet.publicKey) < ONE_SKR || sol < rent + SOL_BUFFER + 20_000) {
    throw new Error('Fund the treasury with at least 1 SKR and enough SOL for the recipient token account and transaction fee before announcing a prize.');
  }
  const existing = await databaseRequest(`hundo_skr_pilots?select=round_id,treasury_wallet&round_id=eq.${roundId}`);
  if (existing?.length) {
    if (existing[0].treasury_wallet !== wallet.publicKey.toBase58()) throw new Error('This round already names another treasury.');
  } else {
    await databaseRequest('hundo_skr_pilots', {
      method: 'POST', body: JSON.stringify({ round_id: roundId, treasury_wallet: wallet.publicKey.toBase58() }),
    });
  }
  console.log(JSON.stringify({ status: 'announced', roundId, treasury: wallet.publicKey.toBase58(), prize: '1 SKR', network: 'mainnet-beta' }, null, 2));
}

async function prepare(directory, roundId, recipientText) {
  const wallet = treasury(directory);
  const recipient = new PublicKey(recipientText);
  if (recipient.equals(wallet.publicKey)) throw new Error('Treasury cannot pay itself.');
  await verifiedSoleFinalist(roundId, recipient);
  const pilot = await pilotRecord(roundId);
  if (pilot.treasury_wallet !== wallet.publicKey.toBase58()) throw new Error('Treasury does not match the announced pilot.');
  const file = receiptFile(directory, roundId);
  if (fs.existsSync(file)) {
    const previous = readPrivateJson(file);
    if (previous.recipient !== recipient.toBase58()) throw new Error('This round already has a different prepared recipient.');
    if (pilot.status === 'announced') await updatePilot(roundId, 'announced', { status: 'prepared', winner_wallet: previous.recipient, signature: previous.signature });
    else if (pilot.winner_wallet !== previous.recipient || pilot.signature !== previous.signature) throw new Error('Pilot database record and local receipt differ.');
    console.log(JSON.stringify({ status: previous.status, roundId, recipient: previous.recipient, signature: previous.signature }));
    return;
  }
  if (pilot.status !== 'announced') throw new Error('This pilot already has a prepared or submitted payment.');
  const connection = await checkedConnection();
  const source = ata(wallet.publicKey), destination = ata(recipient);
  const [sourceInfo, destinationInfo, sol, blockhash] = await Promise.all([
    connection.getAccountInfo(source), connection.getAccountInfo(destination),
    connection.getBalance(wallet.publicKey), connection.getLatestBlockhash(),
  ]);
  if (readTokenAmount(sourceInfo, wallet.publicKey) < ONE_SKR) throw new Error('Treasury needs at least 1 SKR.');
  readTokenAmount(destinationInfo, recipient); // reject an account with the wrong mint/owner
  const tx = new Transaction({ feePayer: wallet.publicKey, ...blockhash });
  if (!destinationInfo) tx.add(createAtaInstruction(wallet.publicKey, recipient, destination));
  tx.add(transferCheckedInstruction(source, destination, wallet.publicKey));
  tx.add(new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(`hundo:1-skr-pilot:${roundId}`) }));
  const fee = (await connection.getFeeForMessage(tx.compileMessage())).value;
  if (fee == null) throw new Error('Could not estimate the transfer fee.');
  const rent = destinationInfo ? 0 : await connection.getMinimumBalanceForRentExemption(165);
  if (sol < fee + rent + SOL_BUFFER) throw new Error(`Treasury needs at least ${fee + rent + SOL_BUFFER} lamports for fee, recipient account and reserve.`);
  tx.sign(wallet);
  const signature = require('bs58').encode(tx.signatures[0].signature);
  savePrivateJson(file, {
    network: 'mainnet-beta', roundId, recipient: recipient.toBase58(), treasury: wallet.publicKey.toBase58(),
    mint: MINT.toBase58(), amountRaw: ONE_SKR.toString(), source: source.toBase58(), destination: destination.toBase58(),
    blockhash, signature, signedTransaction: tx.serialize().toString('base64'), status: 'prepared',
  });
  await updatePilot(roundId, 'announced', { status: 'prepared', winner_wallet: recipient.toBase58(), signature });
  console.log(JSON.stringify({ status: 'prepared', roundId, recipient: recipient.toBase58(), amount: '1 SKR', treasury: wallet.publicKey.toBase58(), signature, createsRecipientTokenAccount: !destinationInfo }, null, 2));
  console.log('Signed transaction saved locally. No tokens have been sent.');
}

async function send(directory, roundId) {
  if (!ROUND_ID.test(roundId)) throw new Error('Provide a valid round UUID.');
  const file = receiptFile(directory, roundId);
  const receipt = readPrivateJson(file);
  if (receipt.roundId !== roundId || receipt.network !== 'mainnet-beta' || receipt.mint !== MINT.toBase58() || receipt.amountRaw !== ONE_SKR.toString()) throw new Error('Unexpected receipt.');
  const wallet = treasury(directory);
  if (receipt.treasury !== wallet.publicKey.toBase58()) throw new Error('Wrong treasury key.');
  if (receipt.status === 'confirmed') {
    console.log(`Already confirmed: https://explorer.solana.com/tx/${receipt.signature}`);
    return;
  }
  const signedBytes = validatedSignedBytes(receipt, wallet);
  const recipient = new PublicKey(receipt.recipient);
  await verifiedSoleFinalist(roundId, recipient);
  const pilot = await pilotRecord(roundId);
  if (pilot.treasury_wallet !== receipt.treasury || pilot.winner_wallet !== receipt.recipient || pilot.signature !== receipt.signature || !['prepared', 'submitted', 'confirmed'].includes(pilot.status)) {
    throw new Error('Pilot database record does not match the prepared signed transfer.');
  }
  const connection = await checkedConnection();
  const status = (await connection.getSignatureStatuses([receipt.signature], { searchTransactionHistory: true })).value[0];
  if (status?.err) throw new Error('Transaction landed with an error; inspect it before retrying.');
  if (!status && (await connection.getBlockHeight()) > receipt.blockhash.lastValidBlockHeight) {
    throw new Error('Prepared blockhash expired. Do not create another payment until the old signature is checked independently.');
  }
  if (!status) {
    const result = await connection.sendRawTransaction(signedBytes, { skipPreflight: false, maxRetries: 3 });
    assert.equal(result, receipt.signature, 'Submitted signature changed.');
    receipt.status = 'submitted';
    savePrivateJson(file + '.submitted', receipt);
    fs.renameSync(file + '.submitted', file);
  }
  if (pilot.status === 'prepared') await updatePilot(roundId, 'prepared', { status: 'submitted' });
  console.log(`Submission: https://explorer.solana.com/tx/${receipt.signature}`);
  console.log('Run verify after confirmation. Re-running send reuses the same signed transaction.');
}

async function verify(directory, roundId) {
  if (!ROUND_ID.test(roundId)) throw new Error('Provide a valid round UUID.');
  const file = receiptFile(directory, roundId);
  const receipt = readPrivateJson(file);
  const connection = await checkedConnection();
  const tx = await connection.getParsedTransaction(receipt.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!tx || tx.meta?.err) throw new Error('Transaction is not finalized successfully yet.');
  const tokenBalances = (rows, accountIndex) => BigInt(rows?.find(row => row.accountIndex === accountIndex && row.mint === MINT.toBase58())?.uiTokenAmount.amount ?? '0');
  const accounts = tx.transaction.message.accountKeys.map(key => key.pubkey.toBase58());
  const sourceIndex = accounts.indexOf(receipt.source), destinationIndex = accounts.indexOf(receipt.destination);
  if (sourceIndex < 0 || destinationIndex < 0 || sourceIndex === destinationIndex) throw new Error('Source or destination token account missing.');
  const spent = tokenBalances(tx.meta.preTokenBalances, sourceIndex) - tokenBalances(tx.meta.postTokenBalances, sourceIndex);
  const received = tokenBalances(tx.meta.postTokenBalances, destinationIndex) - tokenBalances(tx.meta.preTokenBalances, destinationIndex);
  if (spent !== ONE_SKR || received !== ONE_SKR) throw new Error('On-chain token balance change is not exactly 1 SKR.');
  receipt.status = 'confirmed';
  receipt.slot = tx.slot;
  savePrivateJson(file + '.confirmed', { ...receipt, signedTransaction: undefined });
  fs.renameSync(file + '.confirmed', file);
  const pilot = await pilotRecord(roundId);
  if (pilot.treasury_wallet !== receipt.treasury || pilot.winner_wallet !== receipt.recipient || pilot.signature !== receipt.signature) throw new Error('Pilot database record does not match the verified transfer.');
  if (pilot.status !== 'confirmed') await updatePilot(roundId, pilot.status, { status: 'confirmed' });
  console.log(JSON.stringify({ status: 'confirmed', roundId, recipient: receipt.recipient, amount: '1 SKR', signature: receipt.signature, explorer: `https://explorer.solana.com/tx/${receipt.signature}` }, null, 2));
}

async function main() {
  const directory = privateDirectory();
  const [command, roundId, recipient] = process.argv.slice(2);
  if (command === 'status') return status(directory);
  if (command === 'announce' && roundId && !recipient) return announce(directory, roundId);
  if (command === 'prepare' && roundId && recipient) return prepare(directory, roundId, recipient);
  if (command === 'send' && roundId && !recipient) return send(directory, roundId);
  if (command === 'verify' && roundId && !recipient) return verify(directory, roundId);
  throw new Error('Usage: skr-pilot-payout.cjs status | announce ROUND_UUID | prepare ROUND_UUID WINNER_WALLET | send ROUND_UUID | verify ROUND_UUID');
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { ata, createAtaInstruction, transferCheckedInstruction, readTokenAmount, verifiedSoleFinalist, validatedSignedBytes };
