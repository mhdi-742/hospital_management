/**
 * MIKKY MEGHA HOSPITAL - ADVANCE PAYMENT / MONEY RECEIPT LOGIC
 */

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

function saveAdvanceReceipt() {
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
    return;
  }

  if (amount <= 0) {
    showToast("⚠️ Please enter a valid advance amount", "error");
    return;
  }

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
    savedAt: new Date().toISOString(),
  };

  fetch("/api/portal/advance-billing/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(r => {
      if (r.ok) {
        return r.json().then(data => {
          showToast(`✅ Advance Receipt Saved! (${data.receipt?.receiptNo || 'Saved'})`, "success");
        });
      } else {
        return r.json().then(d => showToast("❌ " + (d.error || "Failed to save"), "error"));
      }
    })
    .catch(() => showToast("❌ Network error — receipt not saved", "error"));
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
    caseType: "caseType",
    bedNo: "bedNo",
    receiptDate: "receiptDate",
    amount: "advanceAmount",
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

  setDefaultDate();
  updateTotals();

  if (params.get("autoPrint") === "1" || params.get("print") === "true") {
    setTimeout(() => {
      window.print();
    }, 500);
  }
}

window.printInvoice = printInvoice;
window.togglePrintHeader = togglePrintHeader;
window.updateTotals = updateTotals;
window.resetForm = resetForm;
window.saveAdvanceReceipt = saveAdvanceReceipt;

document.addEventListener("DOMContentLoaded", () => {
  initFromQueryParams();
  togglePrintHeader(false);
});
