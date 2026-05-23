#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

// Helper: spin up a fresh env + deployed contract
fn setup() -> (Env, NongkrongSplitClient<'static>) {
    let env = Env::default();
    let contract_id = env.register_contract(None, NongkrongSplit);
    let client = NongkrongSplitClient::new(&env, &contract_id);
    (env, client)
}

// Helper: create a Soroban String from a &str
fn s(env: &Env, text: &str) -> String {
    String::from_str(env, text)
}

// ─── Test 1: The exact example from the project brief ─────────────────────
//
// A pays 120000, B pays 30000, C pays 0
// Total = 150000 | Fair share = 50000
// A balance = +70000 (creditor)
// B balance = -20000 (debtor)
// C balance = -50000 (debtor)
// Expected: B owes A 20000, C owes A 50000
#[test]
fn test_basic_settlement() {
    let (env, client) = setup();

    client.add_payment(&s(&env, "A"), &120000);
    client.add_payment(&s(&env, "B"), &30000);
    client.add_payment(&s(&env, "C"), &0);

    let result = client.calculate();

    assert_eq!(result.total,      150000);
    assert_eq!(result.fair_share, 50000);
    assert_eq!(result.debts.len(), 2);

    let d0 = result.debts.get(0).unwrap();
    assert_eq!(d0.debtor,   s(&env, "B"));
    assert_eq!(d0.creditor, s(&env, "A"));
    assert_eq!(d0.amount,   20000);

    let d1 = result.debts.get(1).unwrap();
    assert_eq!(d1.debtor,   s(&env, "C"));
    assert_eq!(d1.creditor, s(&env, "A"));
    assert_eq!(d1.amount,   50000);
}

// ─── Test 2: Everyone pays equally → no debts at all ─────────────────────
#[test]
fn test_equal_payments_no_debts() {
    let (env, client) = setup();

    client.add_payment(&s(&env, "Alice"), &50000);
    client.add_payment(&s(&env, "Bob"),   &50000);
    client.add_payment(&s(&env, "Carol"), &50000);

    let result = client.calculate();

    assert_eq!(result.total,       150000);
    assert_eq!(result.fair_share,  50000);
    assert_eq!(result.debts.len(), 0);
}

// ─── Test 3: Two people, one pays everything ──────────────────────────────
#[test]
fn test_two_people_one_payer() {
    let (env, client) = setup();

    client.add_payment(&s(&env, "Dana"), &100000);
    client.add_payment(&s(&env, "Evan"), &0);

    let result = client.calculate();

    assert_eq!(result.total,       100000);
    assert_eq!(result.fair_share,  50000);
    assert_eq!(result.debts.len(), 1);

    let d = result.debts.get(0).unwrap();
    assert_eq!(d.debtor,   s(&env, "Evan"));
    assert_eq!(d.creditor, s(&env, "Dana"));
    assert_eq!(d.amount,   50000);
}

// ─── Test 4: Calling add_payment twice for same name overwrites ───────────
#[test]
fn test_overwrite_payment() {
    let (env, client) = setup();

    client.add_payment(&s(&env, "A"), &100000);
    client.add_payment(&s(&env, "A"), &120000); // should overwrite, not add

    let parts = client.get_participants();

    assert_eq!(parts.len(), 1);
    assert_eq!(parts.get(0).unwrap().paid, 120000);
}

// ─── Test 5: reset() wipes all stored state ───────────────────────────────
#[test]
fn test_reset_clears_state() {
    let (env, client) = setup();

    client.add_payment(&s(&env, "A"), &120000);
    client.add_payment(&s(&env, "B"), &30000);

    client.reset();

    let parts = client.get_participants();
    assert_eq!(parts.len(), 0);
}

// ─── Test 6: Multiple creditors and debtors ───────────────────────────────
//
// A pays 0,     B pays 60000
// C pays 0,     D pays 60000
// Total = 120000 | Fair share = 30000
// B +30000, D +30000 (creditors)
// A -30000, C -30000 (debtors)
// Expected: A owes B 30000, C owes D 30000
#[test]
fn test_multiple_creditors_and_debtors() {
    let (env, client) = setup();

    client.add_payment(&s(&env, "A"), &0);
    client.add_payment(&s(&env, "B"), &60000);
    client.add_payment(&s(&env, "C"), &0);
    client.add_payment(&s(&env, "D"), &60000);

    let result = client.calculate();

    assert_eq!(result.total,       120000);
    assert_eq!(result.fair_share,  30000);
    assert_eq!(result.debts.len(), 2);

    let d0 = result.debts.get(0).unwrap();
    assert_eq!(d0.debtor,   s(&env, "A"));
    assert_eq!(d0.creditor, s(&env, "B"));
    assert_eq!(d0.amount,   30000);

    let d1 = result.debts.get(1).unwrap();
    assert_eq!(d1.debtor,   s(&env, "C"));
    assert_eq!(d1.creditor, s(&env, "D"));
    assert_eq!(d1.amount,   30000);
}