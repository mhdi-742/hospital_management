/**
 * MIKKY MEGHA HOSPITAL - INVESTIGATION BILLING APP LOGIC (v2)
 * Dedicated Investigation Billing with Split Payments & Bill ID
 */

const DEFAULT_ITEMS = [
  { name: "" }
];

function createDiscountItem() {
  return { label: "DISCOUNT:", amount: "" };
}

function createPaymentItem(mode = "Cash", amount = "", ref = "") {
  return { mode, amount, ref };
}

function createItem(name) {
  return { name: name || "", qty: "", priceUnit: "", amount: "" };
}

let billItems = [];
let discountItems = [];
let paymentItems = [];
let currentUserName = "Billing Reception";
let isBillSaved = false;
let isSavingInProgress = false;

// Active saved bill tracking for avoiding duplicate saves
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

/**
 * Add new row to bill items
 */
function addRow() {
  billItems.push(createItem(""));
  markAsUnsaved();
  renderAll();
}

/**
 * Delete row from bill items
 */
function deleteRow(index) {
  if (index >= 0 && index < billItems.length) {
    billItems.splice(index, 1);
    markAsUnsaved();
    renderAll();
  }
}

/**
 * Reset all form fields & table
 */
function resetForm() {
  const fields = [
    "patientName", "patientAge", "underDoctor",
    "referredBy", "billId", "caseType", "contact", "billDate"
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const caseType = document.getElementById("caseType");
  if (caseType) caseType.value = "OPD Diagnostic Booking";

  const referredBy = document.getElementById("referredBy");
  if (referredBy) referredBy.value = "Self";

  const savedAtEl = document.getElementById("savedAtDisplay");
  if (savedAtEl) savedAtEl.textContent = "—";

  activeBillId = null;
  activeBillNo = null;
  activeSavedAt = null;

  isBillSaved = false;
  const statusBadge = document.getElementById("saveStatusBadge");
  if (statusBadge) {
    statusBadge.textContent = "Draft";
    statusBadge.removeAttribute("data-saved");
  }

  setDefaultDate();

  billItems = DEFAULT_ITEMS.map(p => createItem(p.name));
  discountItems = [createDiscountItem()];
  paymentItems = [createPaymentItem("Cash", "", "")];

  renderAll();
  renderDiscounts();
  renderPayments();
}

function setDefaultDate() {
  const dateEl = document.getElementById("billDate");
  if (dateEl && !dateEl.value) {
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    dateEl.value = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
  }
}

/**
 * Add new discount row
 */
function addDiscountRow() {
  discountItems.push(createDiscountItem());
  markAsUnsaved();
  renderDiscounts();
}

/**
 * Delete a discount row
 */
function deleteDiscountRow(index) {
  if (discountItems.length <= 1) {
    discountItems[0] = createDiscountItem();
  } else {
    discountItems.splice(index, 1);
  }
  markAsUnsaved();
  renderDiscounts();
}

/**
 * Add new split payment mode row
 */
function addPaymentRow() {
  paymentItems.push(createPaymentItem("UPI / Online", "", ""));
  markAsUnsaved();
  renderPayments();
}

/**
 * Delete a payment mode row
 */
function deletePaymentRow(index) {
  if (paymentItems.length <= 1) {
    paymentItems[0] = createPaymentItem("Cash", "", "");
  } else {
    paymentItems.splice(index, 1);
  }
  markAsUnsaved();
  renderPayments();
}

/**
 * Print invoice — Automatically saves the bill first if unsaved!
 */
async function printInvoice() {
  if (!isBillSaved) {
    showToast("💾 Saving bill before printing...", "success");
    const saved = await saveBill();
    if (!saved) {
      showToast("❌ Could not save bill. Please fix any errors and try again.", "error");
      return;
    }
    // Delay slightly to let DOM render updated Bill No and Saved Time
    setTimeout(() => {
      window.print();
    }, 400);
  } else {
    window.print();
  }
}

/**
 * Toggle whether the hospital header and outer page border print or not.
 */
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

/**
 * Open Save Decision Modal if bill is already saved
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
 * Save investigation bill to database (Returns Promise<boolean>)
 * If bill has already been saved or loaded with an ID, presents modal to choose.
 */
function saveBill() {
  if (isSavingInProgress) {
    return Promise.resolve(false);
  }

  // If already saved or loaded from existing database bill, prompt user
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

  isSavingInProgress = true;
  const saveBtn = document.getElementById("btnSave");
  if (saveBtn) saveBtn.disabled = true;

  const patientName = document.getElementById("patientName")?.value || "";
  const patientAge = document.getElementById("patientAge")?.value || "";
  const underDoctor = document.getElementById("underDoctor")?.value || "";
  const referredBy = document.getElementById("referredBy")?.value || "Self";
  const billIdInput = document.getElementById("billId")?.value || "";
  const caseType = document.getElementById("caseType")?.value || "Investigation";
  const contact = document.getElementById("contact")?.value || "";
  const billDate = document.getElementById("billDate")?.value || "";

  const netPayableEl = document.getElementById("netPayableDisplay");
  const netPayable = parseFloat(netPayableEl ? netPayableEl.textContent : 0) || 0;

  const totalPaidEl = document.getElementById("totalPaidDisplay");
  const totalPaid = parseFloat(totalPaidEl ? totalPaidEl.textContent : 0) || 0;

  const dueAmountEl = document.getElementById("dueAmountDisplay");
  const dueAmount = parseFloat(dueAmountEl ? dueAmountEl.textContent : 0) || 0;

  const items = billItems
    .filter(i => i.name || i.amount)
    .map(i => ({ name: i.name, qty: i.qty, priceUnit: i.priceUnit, amount: i.amount }));

  const discounts = discountItems
    .filter(d => d.amount)
    .map(d => ({ label: d.label, amount: d.amount }));

  const validPayments = paymentItems
    .filter(p => p.amount && parseFloat(p.amount) > 0)
    .map(p => ({ mode: p.mode, amount: p.amount, ref: p.ref }));

  // Create descriptive payMode summary string (e.g. "Split: Cash ₹300, UPI ₹500" or single mode)
  let payModeSummary = "Cash";
  if (validPayments.length === 1) {
    payModeSummary = `${validPayments[0].mode}${validPayments[0].ref ? ` (Ref: ${validPayments[0].ref})` : ''}`;
  } else if (validPayments.length > 1) {
    payModeSummary = "Split: " + validPayments.map(p => `${p.mode}: ₹${p.amount}${p.ref ? ` (${p.ref})` : ''}`).join(", ");
  }

  const payload = {
    patientName,
    patientAge,
    underDoctor,
    referredBy,
    mmhplId: billIdInput,
    caseType,
    contact,
    billDate,
    advance: totalPaid,
    netPayable,
    dueAmount,
    totalPaid,
    payMode: payModeSummary,
    payments: validPayments,
    createdByName: currentUserName,
    items,
    discounts,
    savedAt: new Date().toISOString(),
  };

  // If updating existing record, pass the database billId
  if (mode === "update" && activeBillId) {
    payload.billId = activeBillId;
  }

  return fetch("/api/portal/investigation-billing/save", {
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

          // Track active bill details
          if (data.bill?.id) activeBillId = data.bill.id;
          if (data.bill?.billNo) activeBillNo = data.bill.billNo;
          if (data.bill?.savedAt) activeSavedAt = data.bill.savedAt;

          const actionMsg = data.isUpdate ? "Updated" : "Saved";
          showToast(`✅ Investigation Bill ${actionMsg}! (${activeBillNo || 'Saved'})`, "success");
          
          const billIdEl = document.getElementById("billId");
          if (billIdEl && activeBillNo) {
            billIdEl.value = activeBillNo;
          }

          const createdByEl = document.getElementById("createdByNameDisplay");
          if (createdByEl && data.bill?.createdByName) {
            createdByEl.textContent = data.bill.createdByName;
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
      showToast("❌ Network error — bill not saved", "error");
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
    referredBy: "referredBy",
    billId: "billId",
    hospitalId: "billId",
    billNo: "billId",
    caseType: "caseType",
    contact: "contact",
    billDate: "billDate",
  };

  for (const [param, elementId] of Object.entries(fieldMap)) {
    const value = params.get(param);
    if (value) {
      const el = document.getElementById(elementId);
      if (el) el.value = decodeURIComponent(value);
    }
  }

  // Load active saved state if opened from Bills History tab
  const paramBillId = params.get("billId");
  const paramBillNo = params.get("billNo");
  const paramSavedAt = params.get("savedAt");

  if (paramBillId) activeBillId = decodeURIComponent(paramBillId);
  if (paramBillNo) activeBillNo = decodeURIComponent(paramBillNo);
  if (paramSavedAt) activeSavedAt = decodeURIComponent(paramSavedAt);

  // If savedAt is provided, display it immediately
  if (activeSavedAt) {
    const savedAtEl = document.getElementById("savedAtDisplay");
    if (savedAtEl) {
      savedAtEl.textContent = formatDateTime(activeSavedAt);
    }
  }

  // If bill is from existing record, mark badge as saved
  if (activeBillNo || activeBillId) {
    isBillSaved = true;
    const statusBadge = document.getElementById("saveStatusBadge");
    if (statusBadge) {
      statusBadge.textContent = activeBillNo ? `Saved (${activeBillNo}) ✓` : "Saved ✓";
      statusBadge.setAttribute("data-saved", "true");
    }
  }

  setDefaultDate();

  // Discount
  const discountVal = params.get("discount");
  if (discountVal && parseFloat(discountVal) > 0) {
    discountItems = [{ label: "DISCOUNT:", amount: decodeURIComponent(discountVal) }];
    renderDiscounts();
  }

  // Populate dynamic test items from URL
  const itemsParam = params.get("items");
  if (itemsParam) {
    try {
      const parsedItems = JSON.parse(decodeURIComponent(itemsParam));
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        billItems = parsedItems.map(item => ({
          name: item.name || item.testName || "",
          qty: String(item.qty || 1),
          priceUnit: String(item.priceUnit || item.rate || ""),
          amount: String(item.amount || ((item.qty || 1) * (item.rate || 0)) || ""),
        }));

        while (billItems.length < 8) {
          billItems.push(createItem(""));
        }

        renderAll();
      }
    } catch (e) {
      console.warn("Could not parse items parameter:", e);
    }
  }

  // Payments / Advance parameter
  const paymentsParam = params.get("payments");
  if (paymentsParam) {
    try {
      const parsedPayments = JSON.parse(decodeURIComponent(paymentsParam));
      if (Array.isArray(parsedPayments) && parsedPayments.length > 0) {
        paymentItems = parsedPayments.map(p => createPaymentItem(p.mode || "Cash", String(p.amount || ""), p.ref || ""));
        renderPayments();
      }
    } catch (e) {
      console.warn("Could not parse payments parameter:", e);
    }
  } else {
    const advanceVal = params.get("advance");
    if (advanceVal && parseFloat(advanceVal) > 0) {
      paymentItems = [createPaymentItem("Advance Deposit / Paid", decodeURIComponent(advanceVal), "")];
      renderPayments();
    }
  }

  calculateTotals();

  // Auto-print if param is set
  if (params.get("autoPrint") === "1" || params.get("print") === "true") {
    setTimeout(() => {
      window.print();
    }, 500);
  }
}

// Expose to window
window.resetForm = resetForm;
window.addRow = addRow;
window.deleteRow = deleteRow;
window.addDiscountRow = addDiscountRow;
window.deleteDiscountRow = deleteDiscountRow;
window.addPaymentRow = addPaymentRow;
window.deletePaymentRow = deletePaymentRow;
window.printInvoice = printInvoice;
window.togglePrintHeader = togglePrintHeader;
window.saveBill = saveBill;
window.openSaveModal = openSaveModal;
window.closeSaveModal = closeSaveModal;
window.confirmSaveExisting = confirmSaveExisting;
window.confirmSaveAsNew = confirmSaveAsNew;

/**
 * Render all table rows
 */
function renderAll() {
  const tbody = document.getElementById("billTbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  billItems.forEach((item, index) => {
    const serial = index + 1;
    const tr = document.createElement("tr");
    tr.className = (serial % 2 === 0) ? "data-row row-even" : "data-row row-odd";

    tr.innerHTML = `
      <td class="col-sl">${serial}</td>
      <td class="col-description">
        <input type="text" class="table-input input-name" list="investigationDataList" data-index="${index}" value="${escapeHtml(item.name)}" placeholder="Item / Test name">
      </td>
      <td class="col-qty">
        <input type="number" class="table-input text-right input-qty" data-index="${index}" value="${item.qty}" placeholder="" min="0" step="any">
      </td>
      <td class="col-price">
        <input type="number" class="table-input text-right input-price" data-index="${index}" value="${item.priceUnit}" placeholder="" min="0" step="any">
      </td>
      <td class="col-amount">
        <input type="number" class="table-input text-right input-amount bold-amount" data-index="${index}" value="${item.amount}" placeholder="" min="0" step="any">
      </td>
      <td class="col-actions no-print">
        <button class="btn-icon-danger btn-delete-row" onclick="deleteRow(${index})" title="Delete Row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  calculateTotals();
}

/**
 * Render all dynamic discount rows directly into tfoot after .row-discount-header
 */
function renderDiscounts() {
  const tfoot = document.querySelector("#billTable tfoot");
  if (!tfoot) return;

  tfoot.querySelectorAll(".row-discount").forEach(r => r.remove());

  const headerRow = tfoot.querySelector(".row-discount-header");
  let insertAfter = headerRow || null;

  discountItems.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.className = "row-summary row-discount";

    tr.innerHTML = `
      <td class="col-sl"></td>
      <td class="col-description">
        <input type="text" class="table-input input-discount-label discount-badge-label"
          data-di="${index}" value="${escapeHtml(item.label)}" placeholder="Discount label">
      </td>
      <td class="col-qty"></td>
      <td class="col-price"></td>
      <td class="col-amount">
        <input type="number" class="table-input text-right input-deduction input-discount-amount"
          data-di="${index}" value="${item.amount}" placeholder="0.00" min="0" step="any">
      </td>
      <td class="col-actions no-print">
        <button class="btn-icon-danger btn-delete-row" onclick="deleteDiscountRow(${index})" title="Remove Discount">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;

    if (insertAfter) {
      insertAfter.insertAdjacentElement("afterend", tr);
    } else {
      tfoot.prepend(tr);
    }
    insertAfter = tr;
  });

  calculateTotals();
}

/**
 * Render all dynamic payment mode (split payment) rows into tfoot after .row-payment-header
 */
function renderPayments() {
  const tfoot = document.querySelector("#billTable tfoot");
  if (!tfoot) return;

  tfoot.querySelectorAll(".row-payment").forEach(r => r.remove());

  const headerRow = tfoot.querySelector(".row-payment-header");
  let insertAfter = headerRow || null;

  paymentItems.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.className = "row-summary row-payment";

    tr.innerHTML = `
      <td class="col-sl" style="text-align: center; color: #0f766e; font-weight: 700; font-size: 0.72rem;">#${index + 1}</td>
      <td class="col-description">
        <div style="display: flex; gap: 6px; align-items: center;">
          <select class="table-input input-payment-mode" data-pi="${index}" style="width: 140px; font-weight: 700;">
            <option value="Cash" ${item.mode === "Cash" ? "selected" : ""}>Cash</option>
            <option value="UPI / Online" ${item.mode === "UPI / Online" ? "selected" : ""}>UPI / Online</option>
            <option value="Debit Card" ${item.mode === "Debit Card" ? "selected" : ""}>Debit Card</option>
            <option value="Credit Card" ${item.mode === "Credit Card" ? "selected" : ""}>Credit Card</option>
            <option value="Cheque / DD" ${item.mode === "Cheque / DD" ? "selected" : ""}>Cheque / DD</option>
            <option value="Bank Transfer" ${item.mode === "Bank Transfer" ? "selected" : ""}>Bank Transfer</option>
          </select>
          <input type="text" class="table-input input-payment-ref" data-pi="${index}" value="${escapeHtml(item.ref || "")}" placeholder="Ref / UPI ID / Notes (optional)" style="flex: 1; font-size: 0.72rem;">
        </div>
      </td>
      <td class="col-qty"></td>
      <td class="col-price"></td>
      <td class="col-amount">
        <input type="number" class="table-input text-right input-payment-amount"
          data-pi="${index}" value="${item.amount}" placeholder="0.00" min="0" step="any">
      </td>
      <td class="col-actions no-print">
        <button class="btn-icon-danger btn-delete-row" onclick="deletePaymentRow(${index})" title="Remove Split Payment Row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;

    if (insertAfter) {
      insertAfter.insertAdjacentElement("afterend", tr);
    }
    insertAfter = tr;
  });

  calculateTotals();
}

function updateRowAmount(index, fromQtyPrice) {
  const row = billItems[index];
  if (!row) return;

  if (fromQtyPrice) {
    const q = parseFloat(row.qty) || 0;
    const p = parseFloat(row.priceUnit) || 0;
    if (q > 0 && p > 0) {
      row.amount = (q * p).toString();
      const tbody = document.getElementById("billTbody");
      if (tbody) {
        const amountInput = tbody.querySelector(`.input-amount[data-index="${index}"]`);
        if (amountInput) amountInput.value = row.amount;
      }
    }
  }
  calculateTotals();
}

/**
 * Calculate Sub Total, Discount, Net Payable, Total Paid, and Due Balance
 */
function calculateTotals() {
  let subTotal = 0;
  billItems.forEach(item => {
    subTotal += parseFloat(item.amount) || 0;
  });

  let totalDiscount = 0;
  discountItems.forEach(d => {
    totalDiscount += parseFloat(d.amount) || 0;
  });

  const netPayable = Math.max(0, subTotal - totalDiscount);

  // If there's exactly 1 payment row and user hasn't typed an amount yet, auto-fill with netPayable
  if (paymentItems.length === 1 && (paymentItems[0].amount === "" || paymentItems[0].amount === undefined)) {
    // leave as is or let user fill
  }

  let totalPaid = 0;
  paymentItems.forEach(p => {
    totalPaid += parseFloat(p.amount) || 0;
  });

  // Due / Balance
  const dueAmount = Math.max(0, netPayable - totalPaid);

  const subTotalDisplay = document.getElementById("subTotalDisplay");
  const netPayableDisplay = document.getElementById("netPayableDisplay");
  const totalPaidDisplay = document.getElementById("totalPaidDisplay");
  const dueAmountDisplay = document.getElementById("dueAmountDisplay");
  const amountInWords = document.getElementById("amountInWords");

  if (subTotalDisplay) subTotalDisplay.textContent = subTotal.toFixed(2);
  if (netPayableDisplay) netPayableDisplay.textContent = netPayable.toFixed(2);
  if (totalPaidDisplay) totalPaidDisplay.textContent = totalPaid.toFixed(2);
  
  if (dueAmountDisplay) {
    dueAmountDisplay.textContent = dueAmount.toFixed(2);
    if (dueAmount > 0) {
      dueAmountDisplay.style.color = "#dc2626"; // Red if due
    } else {
      dueAmountDisplay.style.color = "#16a34a"; // Green if zero balance
    }
  }

  // Amount in words reflects Net Payable
  if (amountInWords) {
    amountInWords.textContent = convertNumberToWords(netPayable);
  }
}

/**
 * Convert number to words in Indian currency format
 */
function convertNumberToWords(amount) {
  if (isNaN(amount) || amount === null || amount === undefined || amount <= 0) {
    return "Rupees Zero Only";
  }

  const num = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - num) * 100);

  if (num === 0 && paise === 0) {
    return "Rupees Zero Only";
  }

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

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let investigationCatalog = [];

function loadInvestigationCatalog() {
  fetch("/api/portal/investigations")
    .then(r => r.json())
    .then(data => {
      investigationCatalog = data.tests || [];
      const datalist = document.getElementById("investigationDataList");
      if (datalist && investigationCatalog.length > 0) {
        datalist.innerHTML = investigationCatalog
          .map(t => `<option value="${escapeHtml(t.name)}">₹${t.amount} (${t.category || 'Pathology'})</option>`)
          .join("");
      }
    })
    .catch(() => { });
}

function initApp() {
  billItems = DEFAULT_ITEMS.map(p => createItem(p.name));
  discountItems = [createDiscountItem()];
  paymentItems = [createPaymentItem("Cash", "", "")];

  renderAll();
  renderDiscounts();
  renderPayments();

  loadCurrentUserSession();
  loadInvestigationCatalog();
  initFromQueryParams();

  // Patient info inputs listener -> mark as unsaved
  const patientInfoBox = document.querySelector(".patient-info-box");
  if (patientInfoBox) {
    patientInfoBox.addEventListener("input", () => {
      markAsUnsaved();
    });
  }

  const tbody = document.getElementById("billTbody");
  if (tbody) {
    tbody.addEventListener("input", (e) => {
      markAsUnsaved();
      const index = parseInt(e.target.getAttribute("data-index"), 10);
      if (isNaN(index)) return;

      const row = billItems[index];
      if (!row) return;

      if (e.target.classList.contains("input-name")) {
        row.name = e.target.value;

        if (investigationCatalog && investigationCatalog.length > 0) {
          const matched = investigationCatalog.find(
            t => t.name.trim().toLowerCase() === row.name.trim().toLowerCase()
          );
          if (matched) {
            row.priceUnit = String(matched.amount);
            if (!row.qty || row.qty === "" || row.qty === "0") {
              row.qty = "1";
            }
            const tr = e.target.closest("tr");
            if (tr) {
              const priceInput = tr.querySelector(".input-price");
              const qtyInput = tr.querySelector(".input-qty");
              if (priceInput) priceInput.value = row.priceUnit;
              if (qtyInput) qtyInput.value = row.qty;
            }
            updateRowAmount(index, true);
          }
        }
      } else if (e.target.classList.contains("input-qty")) {
        row.qty = e.target.value;
        updateRowAmount(index, true);
      } else if (e.target.classList.contains("input-price")) {
        row.priceUnit = e.target.value;
        updateRowAmount(index, true);
      } else if (e.target.classList.contains("input-amount")) {
        row.amount = e.target.value;
        updateRowAmount(index, false);
      }
    });
  }

  const tfoot = document.querySelector("#billTable tfoot");
  if (tfoot) {
    tfoot.addEventListener("input", (e) => {
      markAsUnsaved();
      // Discounts
      const di = parseInt(e.target.getAttribute("data-di"), 10);
      if (!isNaN(di) && discountItems[di]) {
        if (e.target.classList.contains("input-discount-label")) {
          discountItems[di].label = e.target.value;
        } else if (e.target.classList.contains("input-discount-amount")) {
          discountItems[di].amount = e.target.value;
          calculateTotals();
        }
        return;
      }

      // Payments
      const pi = parseInt(e.target.getAttribute("data-pi"), 10);
      if (!isNaN(pi) && paymentItems[pi]) {
        if (e.target.classList.contains("input-payment-ref")) {
          paymentItems[pi].ref = e.target.value;
        } else if (e.target.classList.contains("input-payment-amount")) {
          paymentItems[pi].amount = e.target.value;
          calculateTotals();
        }
      }
    });

    tfoot.addEventListener("change", (e) => {
      markAsUnsaved();
      const pi = parseInt(e.target.getAttribute("data-pi"), 10);
      if (!isNaN(pi) && paymentItems[pi] && e.target.classList.contains("input-payment-mode")) {
        paymentItems[pi].mode = e.target.value;
      }
    });
  }

  togglePrintHeader(false);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
