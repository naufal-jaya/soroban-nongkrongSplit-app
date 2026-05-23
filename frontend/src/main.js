import {
  addPayment,
  getParticipants,
  calculate,
  reset,
  CONTRACT_ID,
} from './contract.js'

// ── DOM refs ──────────────────────────────────────────────────────────────────
const inputName          = document.getElementById('inputName')
const inputAmount        = document.getElementById('inputAmount')
const btnAddPayment      = document.getElementById('btnAddPayment')
const btnGetParticipants = document.getElementById('btnGetParticipants')
const btnCalculate       = document.getElementById('btnCalculate')
const btnReset           = document.getElementById('btnReset')
const participantsList   = document.getElementById('participantsList')
const participantCount   = document.getElementById('participantCount')
const settlementBody     = document.getElementById('settlementBody')
const stellarLabLink     = document.getElementById('stellarLabLink')
const loadingOverlay     = document.getElementById('loadingOverlay')
const loadingText        = document.getElementById('loadingText')
const toast              = document.getElementById('toast')
const toastMsg           = document.getElementById('toastMsg')
const toastIcon          = document.getElementById('toastIcon')

// ── Init ──────────────────────────────────────────────────────────────────────
stellarLabLink.href = `https://lab.stellar.org/r/testnet/contract/${CONTRACT_ID}`

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

let toastTimer
function showToast(msg, type = 'success') {
  const icons = { success: '✓', error: '✕', info: '↻' }
  toastMsg.textContent = msg
  toastIcon.textContent = icons[type] || '✓'
  toast.className = `toast ${type}`
  void toast.offsetWidth // force reflow
  toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500)
}

function setLoading(show, msg = 'Submitting transaction…') {
  loadingText.textContent = msg
  loadingOverlay.classList.toggle('show', show)
}

function setButtonsDisabled(disabled) {
  ;[btnAddPayment, btnGetParticipants, btnCalculate, btnReset].forEach(
    btn => (btn.disabled = disabled)
  )
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderParticipants(list) {
  participantCount.textContent = list.length

  if (list.length === 0) {
    participantsList.innerHTML =
      '<div class="empty-state">No participants yet. Add payments to get started.</div>'
    return
  }

  participantsList.innerHTML = list
    .map(
      (p, i) => `
      <div class="participant-row" style="animation-delay:${i * 0.06}s">
        <span class="participant-name">${escHtml(p.name)}</span>
        <span class="participant-amount">${formatIDR(p.paid)}</span>
      </div>`
    )
    .join('')
}

function renderSettlement(data) {
  if (!data) {
    settlementBody.innerHTML =
      '<div class="empty-state">Run <strong>Calculate Settlement</strong> to see who owes what.</div>'
    return
  }

  const { total, fairShare, debts } = data

  const summaryHtml = `
    <div class="settlement-summary">
      <div class="summary-box">
        <div class="summary-label">Total Spent</div>
        <div class="summary-value accent">${formatIDR(total)}</div>
      </div>
      <div class="summary-box">
        <div class="summary-label">Fair Share / Person</div>
        <div class="summary-value mint">${formatIDR(fairShare)}</div>
      </div>
    </div>`

  if (debts.length === 0) {
    settlementBody.innerHTML =
      summaryHtml +
      '<div class="settled-state">✓ Everyone paid equally — nothing to settle!</div>'
    return
  }

  const debtsHtml = `
    <div class="debt-label">TRANSFERS NEEDED (${debts.length})</div>
    <div class="debts-list">
      ${debts
        .map(
          (d, i) => `
        <div class="debt-row" style="animation-delay:${i * 0.08}s">
          <span class="debt-debtor">${escHtml(d.debtor)}</span>
          <span class="debt-arrow">owes →</span>
          <span class="debt-creditor">${escHtml(d.creditor)}</span>
          <span class="debt-amount">${formatIDR(d.amount)}</span>
        </div>`
        )
        .join('')}
    </div>`

  settlementBody.innerHTML = summaryHtml + debtsHtml
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Event handlers ────────────────────────────────────────────────────────────

btnAddPayment.addEventListener('click', async () => {
  const name   = inputName.value.trim()
  const amount = parseInt(inputAmount.value, 10)

  if (!name) {
    showToast('Please enter a name.', 'error')
    inputName.focus()
    return
  }
  if (isNaN(amount) || amount < 0) {
    showToast('Please enter a valid amount (0 or more).', 'error')
    inputAmount.focus()
    return
  }

  try {
    setButtonsDisabled(true)
    setLoading(true, `Recording payment for ${name}…`)
    await addPayment(name, amount)
    showToast(`${name}'s payment recorded!`, 'success')
    inputName.value   = ''
    inputAmount.value = ''
    inputName.focus()
    // Auto-refresh participants list
    const list = await getParticipants()
    renderParticipants(list)
  } catch (err) {
    console.error(err)
    showToast(`Error: ${err.message}`, 'error')
  } finally {
    setLoading(false)
    setButtonsDisabled(false)
  }
})

btnGetParticipants.addEventListener('click', async () => {
  try {
    setButtonsDisabled(true)
    setLoading(true, 'Fetching participants…')
    const list = await getParticipants()
    renderParticipants(list)
    showToast(`${list.length} participant(s) loaded.`, 'info')
  } catch (err) {
    console.error(err)
    showToast(`Error: ${err.message}`, 'error')
  } finally {
    setLoading(false)
    setButtonsDisabled(false)
  }
})

btnCalculate.addEventListener('click', async () => {
  try {
    setButtonsDisabled(true)
    setLoading(true, 'Computing settlement…')
    const data = await calculate()
    renderSettlement(data)
    showToast(
      data.debts.length === 0
        ? 'All settled — no debts!'
        : `${data.debts.length} transfer(s) needed.`,
      'success'
    )
  } catch (err) {
    console.error(err)
    showToast(`Error: ${err.message}`, 'error')
  } finally {
    setLoading(false)
    setButtonsDisabled(false)
  }
})

btnReset.addEventListener('click', async () => {
  const confirmed = window.confirm(
    'Reset will clear ALL participants and payments from the contract. Continue?'
  )
  if (!confirmed) return

  try {
    setButtonsDisabled(true)
    setLoading(true, 'Resetting contract state…')
    await reset()
    renderParticipants([])
    renderSettlement(null)
    showToast('Contract reset. Ready for a new round!', 'success')
  } catch (err) {
    console.error(err)
    showToast(`Error: ${err.message}`, 'error')
  } finally {
    setLoading(false)
    setButtonsDisabled(false)
  }
})

// Allow Enter key in name field to jump to amount
inputName.addEventListener('keydown', e => {
  if (e.key === 'Enter') inputAmount.focus()
})

// Allow Enter key in amount field to submit
inputAmount.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnAddPayment.click()
})

// ── Boot ──────────────────────────────────────────────────────────────────────
// Load initial state silently on page load
;(async () => {
  try {
    const list = await getParticipants()
    renderParticipants(list)
  } catch {
    // Network might not be reachable yet — silently ignore
  }
})()
