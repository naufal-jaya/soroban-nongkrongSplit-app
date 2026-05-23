#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    symbol_short, vec, Env, Map, String, Symbol, Vec,
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────────────────

/// Stored per participant: their name and how much they paid.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Participant {
    pub name: String,
    pub paid: i128,
}

/// One line in the final settlement report.
/// Reads as: "`debtor` owes `creditor` the value `amount`"
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Debt {
    pub debtor: String,
    pub creditor: String,
    pub amount: i128,
}

/// Full result returned by `calculate()`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Settlement {
    pub total: i128,
    pub fair_share: i128,
    pub debts: Vec<Debt>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Keys
// ─────────────────────────────────────────────────────────────────────────────

const PARTICIPANTS: Symbol = symbol_short!("PARTS");
const NAMES_ORDER: Symbol = symbol_short!("NAMES");

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct NongkrongSplit;

#[contractimpl]
impl NongkrongSplit {

    /// Record (or overwrite) how much a participant paid.
    ///
    /// - `name`   : display name, e.g. "Alice"
    /// - `amount` : how much they paid (non-negative)
    pub fn add_payment(env: Env, name: String, amount: i128) {
        assert!(amount >= 0, "amount must be non-negative");

        let mut participants: Map<String, Participant> = env
            .storage().instance()
            .get(&PARTICIPANTS)
            .unwrap_or_else(|| Map::new(&env));

        let mut names_order: Vec<String> = env
            .storage().instance()
            .get(&NAMES_ORDER)
            .unwrap_or_else(|| vec![&env]);

        // Only add to the ordered list on first appearance
        if !participants.contains_key(name.clone()) {
            names_order.push_back(name.clone());
        }

        participants.set(name.clone(), Participant { name, paid: amount });

        env.storage().instance().set(&PARTICIPANTS, &participants);
        env.storage().instance().set(&NAMES_ORDER, &names_order);
        env.storage().instance().extend_ttl(100, 100);
    }

    /// Return all participants in the order they were added.
    pub fn get_participants(env: Env) -> Vec<Participant> {
        let participants: Map<String, Participant> = env
            .storage().instance()
            .get(&PARTICIPANTS)
            .unwrap_or_else(|| Map::new(&env));

        let names_order: Vec<String> = env
            .storage().instance()
            .get(&NAMES_ORDER)
            .unwrap_or_else(|| vec![&env]);

        let mut result: Vec<Participant> = vec![&env];
        for name in names_order.iter() {
            if let Some(p) = participants.get(name.clone()) {
                result.push_back(p);
            }
        }
        result
    }

    /// Calculate the minimum set of transfers to settle all debts.
    ///
    /// Steps:
    ///   1. total      = sum of all payments
    ///   2. fair_share = total / n  (integer division)
    ///   3. balance[i] = paid[i] - fair_share
    ///      positive → creditor, negative → debtor
    ///   4. Greedy two-pointer match to produce fewest transfers
    pub fn calculate(env: Env) -> Settlement {
        let names_order: Vec<String> = env
            .storage().instance()
            .get(&NAMES_ORDER)
            .unwrap_or_else(|| vec![&env]);

        let participants: Map<String, Participant> = env
            .storage().instance()
            .get(&PARTICIPANTS)
            .unwrap_or_else(|| Map::new(&env));

        let n = names_order.len() as i128;
        assert!(n > 0, "no participants added yet");

        // 1. Total
        let mut total: i128 = 0;
        for name in names_order.iter() {
            if let Some(p) = participants.get(name) {
                total += p.paid;
            }
        }

        // 2. Fair share
        let fair_share = total / n;

        // 3. Build debtor / creditor queues
        let mut debtor_names: Vec<String> = vec![&env];
        let mut debtor_bals: Vec<i128>   = vec![&env];
        let mut creditor_names: Vec<String> = vec![&env];
        let mut creditor_bals: Vec<i128>    = vec![&env];

        for name in names_order.iter() {
            if let Some(p) = participants.get(name.clone()) {
                let bal = p.paid - fair_share;
                if bal < 0 {
                    debtor_names.push_back(name.clone());
                    debtor_bals.push_back(bal);
                } else if bal > 0 {
                    creditor_names.push_back(name.clone());
                    creditor_bals.push_back(bal);
                }
            }
        }

        // 4. Greedy two-pointer settlement
        let mut debts: Vec<Debt> = vec![&env];
        let mut di: u32 = 0;
        let mut ci: u32 = 0;
        let mut d_bal = if debtor_bals.len() > 0 { debtor_bals.get(0).unwrap() } else { 0 };
        let mut c_bal = if creditor_bals.len() > 0 { creditor_bals.get(0).unwrap() } else { 0 };

        while di < debtor_names.len() && ci < creditor_names.len() {
            let debtor   = debtor_names.get(di).unwrap();
            let creditor = creditor_names.get(ci).unwrap();

            let owe = (-d_bal).min(c_bal); // amount to transfer this step

            debts.push_back(Debt {
                debtor:   debtor.clone(),
                creditor: creditor.clone(),
                amount:   owe,
            });

            d_bal += owe;
            c_bal -= owe;

            if d_bal == 0 {
                di += 1;
                if di < debtor_bals.len() {
                    d_bal = debtor_bals.get(di).unwrap();
                }
            }
            if c_bal == 0 {
                ci += 1;
                if ci < creditor_bals.len() {
                    c_bal = creditor_bals.get(ci).unwrap();
                }
            }
        }

        Settlement { total, fair_share, debts }
    }

    /// Clear all stored data so a new expense round can begin.
    pub fn reset(env: Env) {
        env.storage().instance().remove(&PARTICIPANTS);
        env.storage().instance().remove(&NAMES_ORDER);
    }
}

mod test;