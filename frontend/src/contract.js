import {
  Contract,
  Keypair,
  Networks,
  rpc as StellarRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'

// ── Config ────────────────────────────────────────────────────────────────────
const CONTRACT_ID  = 'CBGHHRFBEXOKUYORNJKUVXJ4766KJL2KIOEPYZTNWKNIN63HHINNAZKX'
const RPC_URL      = 'https://soroban-testnet.stellar.org'
const NETWORK_PASS = Networks.TESTNET

// Demo keypair — funded via Friendbot for testnet transactions.
// In production, use Freighter wallet instead.
const DEMO_SECRET  = import.meta.env.VITE_SECRET_KEY || null

const rpcServer = new StellarRpc.Server(RPC_URL, { allowHttp: false })
const contract  = new Contract(CONTRACT_ID)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get or create a demo keypair.
 * Stores the secret in sessionStorage so it persists across page reloads
 * but is gone when the tab closes.
 */
export async function getKeypair() {
  if (DEMO_SECRET) return Keypair.fromSecret(DEMO_SECRET)

  let secret = sessionStorage.getItem('nongkrong_secret')
  if (!secret) {
    const kp = Keypair.random()
    secret = kp.secret()
    sessionStorage.setItem('nongkrong_secret', secret)
    // Fund via Friendbot
    await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
  }
  return Keypair.fromSecret(secret)
}

/**
 * Build, simulate, sign and submit a transaction for a contract invocation.
 * Returns the parsed result value.
 */
async function invoke(method, args = []) {
  const keypair = await getKeypair()
  const account = await rpcServer.getAccount(keypair.publicKey())

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASS,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  // Simulate first to get the footprint
  const sim = await rpcServer.simulateTransaction(tx)
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }

  // Assemble (adds soroban data + resource fees)
  const assembled = StellarRpc.assembleTransaction(tx, sim).build()
  assembled.sign(keypair)

  const result = await rpcServer.sendTransaction(assembled)
  if (result.status === 'ERROR') {
    throw new Error(`Transaction error: ${result.errorResult?.toXDR('base64')}`)
  }

  // Poll for confirmation
  let getResult
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500))
    getResult = await rpcServer.getTransaction(result.hash)
    if (getResult.status !== StellarRpc.Api.GetTransactionStatus.NOT_FOUND) break
  }

  if (getResult.status !== StellarRpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction failed: ${getResult.status}`)
  }

  // Parse return value
  const returnVal = getResult.returnValue
  return returnVal ? scValToNative(returnVal) : null
}

/**
 * Read-only simulation — no signing, no fees, instant.
 */
async function query(method, args = []) {
  const keypair = await getKeypair()
  const account = await rpcServer.getAccount(keypair.publicKey())

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASS,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const sim = await rpcServer.simulateTransaction(tx)
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(`Query failed: ${sim.error}`)
  }

  const returnVal = sim.result?.retval
  return returnVal ? scValToNative(returnVal) : null
}

// ── Public Contract API ───────────────────────────────────────────────────────

/** Record a participant's payment. Overwrites if name already exists. */
export async function addPayment(name, amount) {
  return invoke('add_payment', [
    nativeToScVal(name,   { type: 'string' }),
    nativeToScVal(BigInt(amount), { type: 'i128' }),
  ])
}

/** Return all participants in insertion order. */
export async function getParticipants() {
  const raw = await query('get_participants')
  // raw is an array of objects { name: string, paid: bigint }
  return (raw || []).map(p => ({
    name: p.name,
    paid: Number(p.paid),
  }))
}

/** Compute and return the full settlement. */
export async function calculate() {
  const raw = await query('calculate')
  return {
    total:     Number(raw.total),
    fairShare: Number(raw.fair_share),
    debts: (raw.debts || []).map(d => ({
      debtor:   d.debtor,
      creditor: d.creditor,
      amount:   Number(d.amount),
    })),
  }
}

/** Wipe all stored data. */
export async function reset() {
  return invoke('reset')
}

export { CONTRACT_ID }
