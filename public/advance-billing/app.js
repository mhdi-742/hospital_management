/**
 * MIKKY MEGHA HOSPITAL - ADVANCE PAYMENT / MONEY RECEIPT LOGIC (v2)
 * Money Receipt & Advance Payment Management with Save & Update Existing Support
 */

let currentUserName = "Billing Reception";
let isBillSaved = false;
let isSavingInProgress = false;

// Active saved receipt tracking for avoiding duplicate saves
let activeBillId = null;
let activeBillNo = null;
let activeSavedAt = null;

function markAsUnsaved() {
  isBillSaved = false;
  const statusBadge = document.getElementById("saveStatusBadge");
  if (statusBadge) {
    if (activeBillNo) {
      statusBadge.textContent = `Edited (${activeBillNo}*)`;
      statusBadge.removeAttribute("data-saved");
    } else {
      statusBadge.textContent = "Unsaved Draft";
      statusBadge.removeAttribute("data-saved");
    }
  }
}

function formatDateTime(isoString) {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function loadCurrentUserSession() {
  fetch("/api/auth/session")
    .then(r => r.json())
    .then(data => {
      if (data && data.user && data.user.name) {
        currentUserName = data.user.name;
      } else if (data && data.user && data.user.email) {
        currentUserName = data.user.email.split('@')[0];
      }
      const el = document.getElementById("createdByNameDisplay");
      if (el) el.textContent = currentUserName;
    })
    .catch(() => {
      const el = document.getElementById("createdByNameDisplay");
      if (el) el.textContent = currentUserName;
    });
}

function printInvoice() {
  window.print();
}

function togglePrintHeader(checked) {
  const billHeader = document.querySelector('.bill-header');
  const billPaper = document.getElementById('billPaper');

  if (checked) {
    if (billHeader) billHeader.classList.remove('hide-header-print');
    if (billPaper) billPaper.classList.remove('hide-border-print');
  } else {
    if (billHeader) billHeader.classList.add('hide-header-print');
    if (billPaper) billPaper.classList.add('hide-border-print');
  }
}

function updateTotals() {
  const amountInput = document.getElementById("advanceAmount");
  const val = parseFloat(amountInput?.value || 0) || 0;

  const totalDisplay = document.getElementById("totalAdvanceDisplay");
  if (totalDisplay) {
    totalDisplay.textContent = "₹" + val.toFixed(2);
  }

  const wordsDisplay = document.getElementById("amountInWords");
  if (wordsDisplay) {
    wordsDisplay.textContent = convertNumberToWords(val);
  }
}

function convertNumberToWords(amount) {
  if (isNaN(amount) || amount === null || amount === undefined || amount <= 0) {
    return "Rupees Zero Only";
  }

  const num = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - num) * 100);

  const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teenDigits = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tensDigits = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function numToWords(n) {
    let str = "";
    if (n > 99) {
      str += singleDigits[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      str += teenDigits[n - 10] + " ";
    } else {
      if (n >= 20) {
        str += tensDigits[Math.floor(n / 10)] + " ";
        n %= 10;
      }
      if (n > 0) {
        str += singleDigits[n] + " ";
      }
    }
    return str;
  }

  let result = "";
  let n = num;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remaining = n;

  if (crore > 0) result += numToWords(crore) + "Crore ";
  if (lakh > 0) result += numToWords(lakh) + "Lakh ";
  if (thousand > 0) result += numToWords(thousand) + "Thousand ";
  if (remaining > 0) result += numToWords(remaining);

  result = "Rupees " + result.trim();
  if (paise > 0) result += " and " + numToWords(paise).trim() + " Paise";

  return result + " Only";
}

function resetForm() {
  const fields = [
    "patientName", "patientAge", "underDoctor", "contact", "hospitalId",
    "caseType", "bedNo", "advanceAmount", "transactionId"
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const payMode = document.getElementById("payMode");
  if (payMode) payMode.value = "Cash";

  const caseType = document.getElementById("caseType");
  if (caseType) caseType.value = "IPD Admission Advance";

  const remarks = document.getElementById("remarks");
  if (remarks) remarks.value = "To be adjusted against final hospitalization bill";

  activeBillId = null;
  activeBillNo = null;
  activeSavedAt = null;
  isBillSaved = false;

  const statusBadge = document.getElementById("saveStatusBadge");
  if (statusBadge) {
    statusBadge.textContent = "Draft";
    statusBadge.removeAttribute("data-saved");
  }

  const savedAtEl = document.getElementById("savedAtDisplay");
  if (savedAtEl) savedAtEl.textContent = "—";

  setDefaultDate();
  updateTotals();
}

function setDefaultDate() {
  const dateEl = document.getElementById("receiptDate");
  if (dateEl && !dateEl.value) {
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    dateEl.value = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
  }
}

/**
 * Open Save Decision Modal if receipt is already saved
 */
function openSaveModal() {
  const modal = document.getElementById("saveDecisionModal");
  if (!modal) {
    executeSave("update");
    return;
  }

  const billNoVal = document.getElementById("modalBillNoVal");
  const savedAtVal = document.getElementById("modalSavedAtVal");
  const updateBillNoSpan = document.getElementById("modalUpdateBillNo");

  if (billNoVal) billNoVal.textContent = activeBillNo || "Existing Record";
  if (savedAtVal) savedAtVal.textContent = activeSavedAt ? formatDateTime(activeSavedAt) : "Earlier Today";
  if (updateBillNoSpan) updateBillNoSpan.textContent = activeBillNo || "Existing";

  modal.classList.add("active");
}

function closeSaveModal() {
  const modal = document.getElementById("saveDecisionModal");
  if (modal) modal.classList.remove("active");
}

function confirmSaveExisting() {
  closeSaveModal();
  executeSave("update");
}

function confirmSaveAsNew() {
  closeSaveModal();
  executeSave("new");
}

/**
 * Save advance receipt (Returns Promise<boolean>)
 * If receipt has already been saved or loaded with an ID, presents modal to choose.
 */
function saveAdvanceReceipt() {
  if (isSavingInProgress) {
    return Promise.resolve(false);
  }

  // If already saved or loaded from existing database receipt, prompt user
  if (activeBillId) {
    openSaveModal();
    return Promise.resolve(false);
  }

  return executeSave("new");
}

/**
 * Actual execution of save / update
 * @param {"new"|"update"} mode
 */
function executeSave(mode = "new") {
  if (isSavingInProgress) {
    return Promise.resolve(false);
  }

  const patientName = document.getElementById("patientName")?.value || "";
  const patientAge = document.getElementById("patientAge")?.value || "";
  const underDoctor = document.getElementById("underDoctor")?.value || "";
  const contact = document.getElementById("contact")?.value || "";
  const hospitalId = document.getElementById("hospitalId")?.value || "";
  const caseType = document.getElementById("caseType")?.value || "IPD Advance";
  const bedNo = document.getElementById("bedNo")?.value || "";
  const receiptDate = document.getElementById("receiptDate")?.value || "";
  const amount = parseFloat(document.getElementById("advanceAmount")?.value || 0) || 0;
  const payMode = document.getElementById("payMode")?.value || "Cash";
  const transactionId = document.getElementById("transactionId")?.value || "";
  const remarks = document.getElementById("remarks")?.value || "";

  if (!patientName.trim()) {
    showToast("⚠️ Please enter patient name", "error");
    return Promise.resolve(false);
  }

  if (amount <= 0) {
    showToast("⚠️ Please enter a valid advance amount", "error");
    return Promise.resolve(false);
  }

  isSavingInProgress = true;
  const saveBtn = document.getElementById("btnSave");
  if (saveBtn) saveBtn.disabled = true;

  const payload = {
    patientName,
    patientAge,
    underDoctor,
    contact,
    mmhplId: hospitalId,
    caseType,
    bedNo,
    receiptDate,
    amount,
    payMode,
    transactionId,
    remarks,
    createdByName: currentUserName,
    savedAt: new Date().toISOString(),
  };

  // If updating existing record, pass the database receiptId
  if (mode === "update" && activeBillId) {
    payload.receiptId = activeBillId;
  }

  return fetch("/api/portal/advance-billing/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(r => {
      isSavingInProgress = false;
      if (saveBtn) saveBtn.disabled = false;

      if (r.ok) {
        return r.json().then(data => {
          isBillSaved = true;

          // Track active receipt details
          if (data.receipt?.id) activeBillId = data.receipt.id;
          if (data.receipt?.receiptNo) activeBillNo = data.receipt.receiptNo;
          if (data.receipt?.savedAt) activeSavedAt = data.receipt.savedAt;

          const actionMsg = data.isUpdate ? "Updated" : "Saved";
          showToast(`✅ Advance Receipt ${actionMsg}! (${activeBillNo || 'Saved'})`, "success");

          const createdByEl = document.getElementById("createdByNameDisplay");
          if (createdByEl && data.receipt?.createdByName) {
            createdByEl.textContent = data.receipt.createdByName;
          }

          const savedAtEl = document.getElementById("savedAtDisplay");
          if (savedAtEl && activeSavedAt) {
            savedAtEl.textContent = formatDateTime(activeSavedAt);
          }

          const statusBadge = document.getElementById("saveStatusBadge");
          if (statusBadge) {
            statusBadge.textContent = activeBillNo ? `Saved (${activeBillNo}) ✓` : "Saved ✓";
            statusBadge.setAttribute("data-saved", "true");
          }

          return true;
        });
      } else {
        isBillSaved = false;
        return r.json().then(d => {
          showToast("❌ " + (d.error || "Failed to save"), "error");
          return false;
        }).catch(() => {
          showToast("❌ Failed to save", "error");
          return false;
        });
      }
    })
    .catch(() => {
      isSavingInProgress = false;
      if (saveBtn) saveBtn.disabled = false;
      isBillSaved = false;
      showToast("❌ Network error — receipt not saved", "error");
      return false;
    });
}

function showToast(message, type) {
  const existing = document.getElementById("billing-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "billing-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    padding: 12px 20px; border-radius: 10px; font-weight: 600; font-size: 0.9rem;
    font-family: Inter, sans-serif; box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    transition: opacity 0.4s;
    background: ${type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"};
    border: 1px solid ${type === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"};
    color: ${type === "success" ? "#16a34a" : "#dc2626"};
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function initFromQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const fieldMap = {
    patientName: "patientName",
    patientAge: "patientAge",
    underDoctor: "underDoctor",
    contact: "contact",
    hospitalId: "hospitalId",
    mmhplId: "hospitalId",
    caseType: "caseType",
    bedNo: "bedNo",
    receiptDate: "receiptDate",
    amount: "advanceAmount",
    advanceAmount: "advanceAmount",
    payMode: "payMode",
    transactionId: "transactionId",
    remarks: "remarks"
  };

  for (const [param, elementId] of Object.entries(fieldMap)) {
    const value = params.get(param);
    if (value) {
      const el = document.getElementById(elementId);
      if (el) el.value = decodeURIComponent(value);
    }
  }

  // Load active saved state if opened from Bills History or Reports tab
  const paramReceiptId = params.get("receiptId") || params.get("billId");
  const paramReceiptNo = params.get("receiptNo") || params.get("billNo");
  const paramSavedAt = params.get("savedAt");

  if (paramReceiptId) activeBillId = decodeURIComponent(paramReceiptId);
  if (paramReceiptNo) activeBillNo = decodeURIComponent(paramReceiptNo);
  if (paramSavedAt) activeSavedAt = decodeURIComponent(paramSavedAt);

  // If savedAt is provided, display it immediately
  if (activeSavedAt) {
    const savedAtEl = document.getElementById("savedAtDisplay");
    if (savedAtEl) {
      savedAtEl.textContent = formatDateTime(activeSavedAt);
    }
  }

  // If receipt is from existing record, mark badge as saved
  if (activeBillNo || activeBillId) {
    isBillSaved = true;
    const statusBadge = document.getElementById("saveStatusBadge");
    if (statusBadge) {
      statusBadge.textContent = activeBillNo ? `Saved (${activeBillNo}) ✓` : "Saved ✓";
      statusBadge.setAttribute("data-saved", "true");
    }
  }

  setDefaultDate();
  updateTotals();

  if (params.get("autoPrint") === "1" || params.get("print") === "true") {
    setTimeout(() => {
      window.print();
    }, 500);
  }
}

// Bind input change listeners to mark as unsaved
function setupChangeListeners() {
  const inputs = document.querySelectorAll("input, select, textarea");
  inputs.forEach(input => {
    input.addEventListener("input", markAsUnsaved);
    input.addEventListener("change", markAsUnsaved);
  });
}

// Expose to window
window.printInvoice = printInvoice;
window.togglePrintHeader = togglePrintHeader;
window.updateTotals = updateTotals;
window.resetForm = resetForm;
window.saveAdvanceReceipt = saveAdvanceReceipt;
window.openSaveModal = openSaveModal;
window.closeSaveModal = closeSaveModal;
window.confirmSaveExisting = confirmSaveExisting;
window.confirmSaveAsNew = confirmSaveAsNew;

document.addEventListener("DOMContentLoaded", () => {
  loadCurrentUserSession();
  initFromQueryParams();
  togglePrintHeader(false);
  setupChangeListeners();
});
