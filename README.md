# Nongkrong Split 💸
### On-chain Group Expense Settlement — Soroban Smart Contract

> Built on Stellar's Soroban platform. No more manual calculations, no more awkward "who owes who" conversations. The blockchain handles it.

---

## Key

Contract Address: CBGHHRFBEXOKUYORNJKUVXJ4766KJL2KIOEPYZTNWKNIN63HHINNAZKX

## The Problem

When you go out with friends — makan bareng, traveling, nongkrong — someone always ends up paying for the group. Splitting it manually is:

- Confusing with large groups
- Prone to human error
- Time-consuming
- Sometimes unfair

## The Solution

**Nongkrong Split** is a smart contract that lives on the Stellar testnet. Each person records what they paid. The contract automatically figures out who owes who — and how much — with zero manual math.

### Example

| Person | Paid    |
|--------|---------|
| A      | 120,000 |
| B      | 30,000  |
| C      | 0       |

**Total:** 150,000 → **Fair share per person:** 50,000

**Settlement result:**
- B owes A **20,000**
- C owes A **50,000**

---

## Project Structure

```
Cargo.toml                              ← Workspace root
contracts/
  nongkrong-split/
    Cargo.toml                          ← Contract package
    src/
      lib.rs                            ← Smart contract logic
      test.rs                           ← Unit tests
```

---

## Smart Contract Functions

### `add_payment(name, amount)`
Record how much a participant paid. Call this once per person. Calling it again with the same name **overwrites** their previous amount.

```
name   → String  (e.g. "Alice")
amount → i128    (e.g. 120000)
```

### `get_participants()`
Returns all stored participants in the order they were added.

```json
[
  { "name": "A", "paid": 120000 },
  { "name": "B", "paid": 30000  },
  { "name": "C", "paid": 0      }
]
```

### `calculate()`
Computes the full settlement. Returns total, fair share, and the minimum list of transfers needed to settle all debts.

```json
{
  "total": 150000,
  "fair_share": 50000,
  "debts": [
    { "debtor": "B", "creditor": "A", "amount": 20000 },
    { "debtor": "C", "creditor": "A", "amount": 50000 }
  ]
}
```

### `reset()`
Wipes all stored data. Use this to start a fresh expense round.

---

## How to Use in Soroban Studio

### Step 1 — Set up the project

1. Open [soroban.studio](https://soroban.studio) and start from the **Notes** template
2. Replace the template files with this project's files:

| Template file | Replace with |
|---|---|
| Root `Cargo.toml` | This project's root `Cargo.toml` |
| `contracts/notes/Cargo.toml` | `contracts/nongkrong-split/Cargo.toml` |
| `contracts/notes/src/lib.rs` | `src/lib.rs` |
| `contracts/notes/src/test.rs` | `src/test.rs` |

> Tip: rename the `notes/` folder to `nongkrong-split/` and update the workspace member path in the root `Cargo.toml` to match.

### Step 2 — Build & Deploy

1. Hit **Build** in Soroban Studio — it compiles the contract to WASM
2. Hit **Deploy** — Studio deploys it to Stellar testnet and gives you a **Contract ID**

### Step 3 — Interact via Stellar Lab

Open your deployed contract in Stellar Lab:

```
https://lab.stellar.org/r/testnet/contract/YOUR_CONTRACT_ID
```

From there you can invoke each function directly in the browser.

---

## Demo Flow

```
1. add_payment  →  name: "A",  amount: 120000
2. add_payment  →  name: "B",  amount: 30000
3. add_payment  →  name: "C",  amount: 0
4. get_participants             ← verify stored data
5. calculate                    ← view the settlement
6. reset                        ← clear for next round
```

---

## Settlement Algorithm

The contract uses a **greedy two-pointer algorithm** to produce the fewest possible transfers:

1. Compute `total` = sum of all payments
2. Compute `fair_share` = `total / n` (integer division)
3. For each person: `balance = paid − fair_share`
   - Positive balance → **creditor** (is owed money)
   - Negative balance → **debtor** (owes money)
4. Greedily match the largest debtor with the largest creditor, record the transfer, repeat until all balances are zero

This guarantees **at most n−1 transfers** for n participants — the theoretical minimum.

---

## Tests

Six unit tests are included in `test.rs`:

| Test | What it checks |
|------|----------------|
| `test_basic_settlement` | The A/B/C example — matches project brief exactly |
| `test_equal_payments_no_debts` | Everyone pays equally → zero debts |
| `test_two_people_one_payer` | One person covers both → single transfer |
| `test_overwrite_payment` | Calling `add_payment` twice for same name overwrites |
| `test_reset_clears_state` | All data is gone after `reset()` |
| `test_multiple_creditors_and_debtors` | Two creditors, two debtors — correctly matched |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract language | Rust |
| Contract platform | Soroban (Stellar) |
| Network | Stellar Testnet |
| IDE | Soroban Studio |
| Contract explorer | Stellar Lab |

---

## Why Blockchain?

Traditional expense apps rely on a central server you have to trust. With Soroban:

- **Transparent** — anyone can verify the calculation on-chain
- **Immutable** — recorded payments can't be quietly changed
- **Trustless** — no middleman, the math runs on the contract itself
- **Permanent** — settlement history lives on the ledger

---

## License

MIT — free to use, fork, and build on.