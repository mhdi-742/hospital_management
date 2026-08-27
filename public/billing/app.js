/**
 * MIKKY MEGHA HOSPITAL - BILLING APP LOGIC (v2)
 * Format: QTY × Price/Unit = Amount
 * Single unified bill items list
 */

// All default bill items in one main list
const DEFAULT_ITEMS = [
  { name: "REGISTRATION CHARGE" },
  { name: "MEDICINE CHARGE" },
  { name: "INVESTIGATION" },
  { name: "FOODING" },
  { name: "BED CHARGE" },
  { name: "OT CHARGE" },
  { name: "OXYGEN" },
  { name: "BOYLE'S CHARGE" },
  { name: "BLOOD CHARGE" },
  { name: "BLOOD TRANSFUSION DONE" },
  { name: "SURGEON CHARGE" },
  { name: "ANAESTHESIA CHARGE" },
  { name: "OT ASSISTANT" },
  { name: "SPECIALIST DOCTOR CHARGE" },
  { name: "PHOTO THERAPY" },
  { name: "R.M.O CHARGE" },
  { name: "SERVICE CHARGE" },
  { name: "GLUCOMETRE" },
  { name: "A.B.G CHARGE" },
  { name: "TRANSPORT CHARGE" },
  { name: "LIGATION" },
  { name: "" },
  { name: "" },
  { name: "" }
];

function createDiscountItem() {
  return { label: "DISCOUNT:", amount: "" };
}

function createItem(name) {
  return { name: name || "", qty: "", priceUnit: "", amount: "" };
}

let billItems = [];
let discountItems = [];
let currentUserName = "Billing Staff";
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
    "noOfDays", "hospitalId", "caseType", "bedNo", "billDate",
    "advanceInput"
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

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

  billItems = DEFAULT_ITEMS.map(p => createItem(p.name));
  discountItems = [createDiscountItem()];
  renderAll();
  renderDiscounts();
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
    // Keep at least one row — just clear it instead
    discountItems[0] = createDiscountItem();
  } else {
    discountItems.splice(index, 1);
  }
  markAsUnsaved();
  renderDiscounts();
}


/**
 * Print invoice
 */
function printInvoice() {
  window.print();
}

/**
 * Toggle whether the hospital header and outer page border print or not.
 * When unchecked (default): header & outer border hidden (for pre-printed letterhead pad)
 * When checked: header & outer border print (for plain paper)
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
 * Save bill to hospital database (Returns Promise<boolean>)
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

  const patientName  = document.getElementById("patientName")?.value || "";
  const patientAge   = document.getElementById("patientAge")?.value || "";
  const underDoctor  = document.getElementById("underDoctor")?.value || "";
  const noOfDays     = document.getElementById("noOfDays")?.value || "";
  const hospitalId   = document.getElementById("hospitalId")?.value || "";
  const caseType     = document.getElementById("caseType")?.value || "";
  const bedNo        = document.getElementById("bedNo")?.value || "";
  const billDate     = document.getElementById("billDate")?.value || "";
  const advance      = document.getElementById("advanceInput")?.value || "0";

  const netPayableEl = document.getElementById("netPayableDisplay");
  const netPayable   = netPayableEl ? netPayableEl.textContent : "0";

  const items = billItems
    .filter(i => i.name || i.amount)
    .map(i => ({ name: i.name, qty: i.qty, priceUnit: i.priceUnit, amount: i.amount }));

  const discounts = discountItems
    .filter(d => d.amount)
    .map(d => ({ label: d.label, amount: d.amount }));

  isSavingInProgress = true;
  const saveBtn = document.getElementById("btnSave");
  if (saveBtn) saveBtn.disabled = true;

  const payload = {
    patientName,
    patientAge,
    underDoctor,
    noOfDays,
    mmhplId: hospitalId,
    caseType,
    bedNo,
    billDate,
    advance,
    netPayable,
    items,
    discounts,
    createdByName: currentUserName,
    savedAt: new Date().toISOString(),
  };

  // If updating existing record, pass the database billId
  if (mode === "update" && activeBillId) {
    payload.billId = activeBillId;
  }

  return fetch("/api/portal/billing/save", {
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
          showToast(`✅ Hospital Bill ${actionMsg}! (${activeBillNo || 'Saved'})`, "success");

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
    patientAge:  "patientAge",
    underDoctor: "underDoctor",
    noOfDays:    "noOfDays",
    hospitalId:  "hospitalId",
    mmhplId:     "hospitalId",
    caseType:    "caseType",
    bedNo:       "bedNo",
    billDate:    "billDate",
  };

  for (const [param, elementId] of Object.entries(fieldMap)) {
    const value = params.get(param);
    if (value) {
      const el = document.getElementById(elementId);
      if (el) el.value = decodeURIComponent(value);
    }
  }

  // Load active saved state if opened from Bills History or Reports tab
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

  // Advance payment
  const advanceVal = params.get("advance");
  if (advanceVal) {
    const advanceEl = document.getElementById("advanceInput");
    if (advanceEl) advanceEl.value = decodeURIComponent(advanceVal);
  }

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

        // Pad with empty rows to preserve nice invoice layout if fewer than 8 items
        while (billItems.length < 8) {
          billItems.push(createItem(""));
        }

        renderAll();
      }
    } catch (e) {
      console.warn("Could not parse items parameter:", e);
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
window.addHospitalRow = addRow;
window.addOutsideRow = addRow;
window.deleteHospitalRow = deleteRow;
window.deleteOutsideRow = deleteRow;
window.printInvoice = printInvoice;
window.togglePrintHeader = togglePrintHeader;
window.saveBill = saveBill;
window.openSaveModal = openSaveModal;
window.closeSaveModal = closeSaveModal;
window.confirmSaveExisting = confirmSaveExisting;
window.confirmSaveAsNew = confirmSaveAsNew;

function isInvestigationBill() {
  const caseTypeEl = document.getElementById("caseType");
  const caseVal = (caseTypeEl?.value || "").toLowerCase().trim();
  const urlParams = new URLSearchParams(window.location.search);
  const urlCase = (urlParams.get("caseType") || urlParams.get("billType") || "").toLowerCase().trim();

  return (
    caseVal.includes("investigation") ||
    caseVal.includes("diagnostic") ||
    caseVal.includes("lab") ||
    urlCase.includes("investigation") ||
    urlCase.includes("diagnostic") ||
    urlCase.includes("lab")
  );
}

/**
 * Render all table rows
 */
function renderAll() {
  const tbody = document.getElementById("billTbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const useInvestigationList = isInvestigationBill();
  const listAttr = useInvestigationList ? 'list="investigationDataList"' : '';

  billItems.forEach((item, index) => {
    const serial = index + 1;
    const tr = document.createElement("tr");
    tr.className = (serial % 2 === 0) ? "data-row row-even" : "data-row row-odd";

    tr.innerHTML = `
      <td class="col-sl">${serial}</td>
      <td class="col-description">
        <input type="text" class="table-input input-name" ${listAttr} data-index="${index}" value="${escapeHtml(item.name)}" placeholder="Item name">
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
 * Render all dynamic discount rows directly into tfoot after the discount header row.
 * We cannot use a nested <tbody> inside <tfoot> — browsers reject invalid HTML and
 * move those rows out of position. Instead we insert <tr> elements directly into tfoot.
 */
function renderDiscounts() {
  const tfoot = document.querySelector("#billTable tfoot");
  if (!tfoot) return;

  // Remove all existing discount data rows
  tfoot.querySelectorAll(".row-discount").forEach(r => r.remove());

  // Find the header row to insert discount rows after it
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
          data-di="${index}" value="${item.amount}" placeholder="0" min="0" step="any">
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
 * Calculate Sub Total, Discount, Advance Payment, Net Payable
 */
function calculateTotals() {
  let subTotal = 0;

  billItems.forEach(item => {
    subTotal += parseFloat(item.amount) || 0;
  });

  // Sum all discount rows
  let totalDiscount = 0;
  discountItems.forEach(d => {
    totalDiscount += parseFloat(d.amount) || 0;
  });

  const advanceEl = document.getElementById("advanceInput");
  const advance = parseFloat(advanceEl ? advanceEl.value : 0) || 0;

  // Net Payable = Sub Total - Total Discount - Advance Payment
  const netPayable = Math.max(0, subTotal - totalDiscount - advance);

  const subTotalDisplay = document.getElementById("subTotalDisplay");
  const netPayableDisplay = document.getElementById("netPayableDisplay");
  const amountInWords = document.getElementById("amountInWords");

  if (subTotalDisplay) subTotalDisplay.textContent = subTotal > 0 ? subTotal : "0";
  if (netPayableDisplay) netPayableDisplay.textContent = netPayable > 0 ? netPayable : "0";
  if (amountInWords) amountInWords.textContent = convertNumberToWords(netPayable);
}

/**
 * Convert number to words in Indian currency format
 */
function convertNumberToWords(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) {
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

/**
 * Escape HTML utility
 */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Rate chart catalog cache
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
    .catch(() => {});
}

// Bind input change listeners to mark as unsaved
function setupChangeListeners() {
  const inputs = document.querySelectorAll(".patient-info-box input, .patient-info-box select");
  inputs.forEach(input => {
    input.addEventListener("input", markAsUnsaved);
    input.addEventListener("change", markAsUnsaved);
  });
}

/**
 * Initialize application
 */
function initApp() {
  loadCurrentUserSession();

  billItems = DEFAULT_ITEMS.map(p => createItem(p.name));
  discountItems = [createDiscountItem()];
  renderAll();
  renderDiscounts();

  // Load investigation rate chart options
  loadInvestigationCatalog();

  // Autofill patient details from URL parameters
  initFromQueryParams();

  // Setup form inputs change listeners
  setupChangeListeners();

  // Delegated event listener for all bill table inputs
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

        // Autocomplete price from Rate Chart only for Investigation/Admission bills
        if (isInvestigationBill() && investigationCatalog && investigationCatalog.length > 0) {
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
              const qtyInput   = tr.querySelector(".input-qty");
              if (priceInput) priceInput.value = row.priceUnit;
              if (qtyInput)   qtyInput.value   = row.qty;
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

  // Delegated event listener for discount rows (on tfoot since rows are directly inside it)
  const tfoot = document.querySelector("#billTable tfoot");
  if (tfoot) {
    tfoot.addEventListener("input", (e) => {
      markAsUnsaved();
      const index = parseInt(e.target.getAttribute("data-di"), 10);
      if (isNaN(index) || !discountItems[index]) return;

      if (e.target.classList.contains("input-discount-label")) {
        discountItems[index].label = e.target.value;
      } else if (e.target.classList.contains("input-discount-amount")) {
        discountItems[index].amount = e.target.value;
        calculateTotals();
      }
    });
  }

  // Advance input listener
  const advanceInput = document.getElementById("advanceInput");
  if (advanceInput) {
    advanceInput.addEventListener("input", () => {
      markAsUnsaved();
      calculateTotals();
    });
  }

  // Case type listener to switch investigation datalist on/off dynamically
  const caseTypeInput = document.getElementById("caseType");
  if (caseTypeInput) {
    caseTypeInput.addEventListener("input", () => {
      markAsUnsaved();
      const useList = isInvestigationBill();
      const listVal = useList ? "investigationDataList" : "";
      document.querySelectorAll("#billTbody .input-name").forEach(inp => {
        if (listVal) {
          inp.setAttribute("list", listVal);
        } else {
          inp.removeAttribute("list");
        }
      });
    });
  }

  // Default: header hidden during print (pre-printed pad mode)
  togglePrintHeader(false);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
