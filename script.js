/*********************** CONSTANTS ***************************/
const ENTRIES_KEY = "mc_entries_v2"; // [{id,name,phone,type,createdAt,marks:{j1,j2}}]
const UPDATED_KEY = "mc_updated_at_v2";
const DB_NAME = "mc_media_db";
const DB_STORE = "media";

/*********************** IndexedDB helpers *******************/
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPutBlob(id, file) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DB_STORE).put({ id, blob: file, type: file.type });
  });
}
async function idbGetBlob(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbDeleteBlob(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const req = tx.objectStore(DB_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/*********************** LocalStorage entries *****************/
function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(ENTRIES_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveEntries(list) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(list));
  localStorage.setItem(UPDATED_KEY, String(Date.now()));
}
function upsertEntry(entry) {
  const list = loadEntries();
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  saveEntries(list);
}
function deleteEntry(id) {
  const list = loadEntries().filter((e) => e.id !== id);
  saveEntries(list);
}

/* Marks helpers */
function setMark(entryId, judgeRole, value) {
  const list = loadEntries();
  const idx = list.findIndex((e) => e.id === entryId);
  if (idx === -1) return;
  const entry = list[idx];
  entry.marks = entry.marks || { j1: null, j2: null };
  if (judgeRole === "judge1") entry.marks.j1 = value;
  if (judgeRole === "judge2") entry.marks.j2 = value;
  list[idx] = entry;
  saveEntries(list);
}
function getEntryById(id) {
  return loadEntries().find((e) => e.id === id) || null;
}

/* Role */
const role = localStorage.getItem("role") || "public";

/*********************** COMMON UI: AUTH + HIDE UPLOAD *************/
(function setupAuth() {
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutArea = document.getElementById("logoutArea");

  // Show logout only for admin/judges
  if (
    logoutBtn &&
    (role === "admin" || role === "judge1" || role === "judge2")
  ) {
    if (logoutArea) logoutArea.classList.remove("hidden");
    logoutBtn.onclick = () => {
      localStorage.removeItem("role");
      alert("Logged out successfully!");
      window.location.href = "index.html";
    };
  }

  // 🔴 Hide Upload buttons for Admin and Judges
  if (role === "admin" || role === "judge1" || role === "judge2") {
    const up1 = document.getElementById("uploadLink");
    const up2 = document.getElementById("uploadLinkView");
    if (up1) up1.style.display = "none";
    if (up2) up2.style.display = "none";

    // If they try direct access to upload.html, redirect to view.html
    if (location.pathname.endsWith("upload.html")) {
      window.location.replace("view.html");
    }
  }
})();

/*********************** UPLOAD PAGE *************************/
(function uploadPage() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  const wrap = document.getElementById("progressWrap");
  const bar = document.getElementById("progressBar");
  const txt = document.getElementById("progressText");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("cname").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];

    if (!name) {
      alert("Please enter your name.");
      return;
    }
    if (!/^[0-9+\-\s]{8,15}$/.test(phone)) {
      alert("Please enter a valid WhatsApp number.");
      return;
    }
    if (!file) {
      alert("Please select an audio or video file.");
      return;
    }

    const type = file.type.startsWith("video")
      ? "video"
      : file.type.startsWith("audio")
      ? "audio"
      : null;
    if (!type) {
      alert("File must be audio or video.");
      return;
    }

    // One entry per phone
    const entries = loadEntries();
    if (entries.some((e) => e.phone === phone)) {
      alert(
        "This phone number has already uploaded an entry. Only one entry per contestant is allowed."
      );
      return;
    }

    // Show progress
    wrap.classList.remove("hidden");
    bar.style.width = "0%";
    txt.textContent = "0%";

    try {
      // Progress UI (read), then store Blob in IDB
      await readArrayBufferWithProgress(file, (loaded, total) => {
        const pct = total ? Math.round((loaded / total) * 100) : 0;
        bar.style.width = pct + "%";
        txt.textContent = pct + "%";
      });

      const id = cryptoRandomId();
      await idbPutBlob(id, file);

      const entry = {
        id,
        name,
        phone,
        type,
        createdAt: Date.now(),
        marks: { j1: null, j2: null },
      };
      upsertEntry(entry);

      bar.style.width = "100%";
      txt.textContent = "100%";
      setTimeout(() => {
        window.location.href = "view.html";
      }, 400);
    } catch (err) {
      console.error(err);
      if (isQuotaError(err)) {
        alert(
          "Your browser ran out of storage for this file. Please upload a smaller file."
        );
      } else {
        alert("There was an error saving your file. Please try again.");
      }
    }
  });
})();

function readArrayBufferWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onprogress = (e) => {
      if (onProgress) onProgress(e.loaded, e.total);
    };
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error("FileReader error"));
    fr.readAsArrayBuffer(file);
  });
}
function isQuotaError(err) {
  return err && (err.name === "QuotaExceededError" || err.code === 22);
}
function cryptoRandomId() {
  return crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2) + Date.now();
}

/*********************** VIEW PAGE ***************************/
(function viewPage() {
  const bodyEl = document.getElementById("songsBody");
  const tableEl = document.getElementById("songsTable");
  if (!bodyEl || !tableEl) return;

  const modeEl = document.getElementById("viewMode");
  if (modeEl) {
    const label =
      role === "admin"
        ? "Admin"
        : role === "judge1"
        ? "James"
        : role === "judge2"
        ? "Ananth"
        : "Public";
    modeEl.textContent = label;
  }

  // Remove the Actions header for non-admins
  if (role !== "admin" && tableEl.tHead && tableEl.tHead.rows.length) {
    const headRow = tableEl.tHead.rows[0];
    const lastTh = headRow.lastElementChild;
    if (lastTh && lastTh.dataset && lastTh.dataset.actions === "1") {
      headRow.removeChild(lastTh);
    }
  }

  function statusText(entry) {
    const j1 = entry.marks?.j1 ?? null;
    const j2 = entry.marks?.j2 ?? null;
    const both = j1 !== null && j2 !== null;
    const none = j1 === null && j2 === null;
    const partial = !both && !none;

    if (role === "judge1" || role === "judge2") {
      const my = role === "judge1" ? j1 : j2;
      const other = role === "judge1" ? j2 : j1;
      if (none || (my === null && other !== null))
        return `<span class="badge gray">Not judged yet</span>`;
      if (my !== null && other === null)
        return `<span class="badge blue">Waiting for other judge</span>`;
      if (both)
        return `<span class="badge green">Total: ${
          j1 + j2
        }/50 (James: ${j1}, Ananth: ${j2})</span>`;
    }

    if (none) return `<span class="badge gray">Not judged yet</span>`;
    if (partial) return `<span class="badge blue">Partial judgement</span>`;
    return `<span class="badge green">Total: ${j1 + j2}/50</span>`;
  }

  function render() {
    const rows = loadEntries().slice();

    // Sorting: fully-judged first by total desc; others by name
    rows.sort((a, b) => {
      const j1a = a.marks?.j1 ?? null,
        j2a = a.marks?.j2 ?? null;
      const j1b = b.marks?.j1 ?? null,
        j2b = b.marks?.j2 ?? null;
      const bothA = j1a !== null && j2a !== null;
      const bothB = j1b !== null && j2b !== null;

      if (bothA && bothB) {
        const ta = j1a + j2a,
          tb = j1b + j2b;
        if (tb !== ta) return tb - ta;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (bothA && !bothB) return -1;
      if (!bothA && bothB) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    bodyEl.innerHTML = "";
    rows.forEach((e, i) => {
      const tr = document.createElement("tr");
      tr.className = "clickable";
      tr.onclick = () => {
        window.location.href = `contestant.html?id=${encodeURIComponent(e.id)}`;
      };

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(i + 1);

      const tdName = document.createElement("td");
      tdName.innerHTML = `<strong>${escapeHtml(e.name)}</strong>`;

      const tdPhone = document.createElement("td");
      tdPhone.textContent = e.phone;

      const tdStatus = document.createElement("td");
      tdStatus.innerHTML = statusText(e);

      tr.appendChild(tdIdx);
      tr.appendChild(tdName);
      tr.appendChild(tdPhone);
      tr.appendChild(tdStatus);

      // Admin-only Actions cell
      if (role === "admin") {
        const tdAct = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.className = "btn";
        editBtn.textContent = "Edit";
        editBtn.style.marginRight = "6px";

        const delBtn = document.createElement("button");
        delBtn.className = "btn";
        delBtn.textContent = "Delete";

        editBtn.onclick = (ev) => {
          ev.stopPropagation();
          adminEditEntry(e.id, render);
        };
        delBtn.onclick = async (ev) => {
          ev.stopPropagation();
          if (confirm("Delete this entry?")) {
            deleteEntry(e.id);
            try {
              await idbDeleteBlob(e.id);
            } catch {}
            render();
          }
        };

        tdAct.appendChild(editBtn);
        tdAct.appendChild(delBtn);
        tr.appendChild(tdAct);
      }

      bodyEl.appendChild(tr);
    });
  }

  window.addEventListener("storage", (e) => {
    if (e.key === ENTRIES_KEY || e.key === UPDATED_KEY) render();
  });

  render();
})();

/*********************** CONTESTANT PAGE *******************************/
(function contestantPage() {
  const container = document.getElementById("contestantDetails");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const entry = getEntryById(id);

  if (!entry) {
    container.innerHTML = "<p>Entry not found.</p>";
    return;
  }

  container.innerHTML = `
    <h2>${escapeHtml(entry.name)}</h2>
    <p><strong>WhatsApp:</strong> ${escapeHtml(entry.phone)}</p>
  `;

  // Load blob from IDB and display
  (async () => {
    const rec = await idbGetBlob(entry.id);
    if (!rec || !rec.blob) {
      const msg = document.createElement("p");
      msg.textContent = "Media not found in this browser.";
      container.appendChild(msg);
      return;
    }
    const url = URL.createObjectURL(rec.blob);
    if (entry.type === "video") {
      const v = document.createElement("video");
      v.controls = true;
      v.playsInline = true;
      v.src = url;
      container.appendChild(v);
    } else {
      const a = document.createElement("audio");
      a.controls = true;
      a.src = url;
      container.appendChild(a);
    }
  })();

  const info = document.createElement("p");
  container.appendChild(info);

  function renderInfo() {
    const ref = getEntryById(id);
    const j1 = ref?.marks?.j1 ?? null;
    const j2 = ref?.marks?.j2 ?? null;
    const both = j1 !== null && j2 !== null;
    const none = j1 === null && j2 === null;
    const partial = !both && !none;

    if (role === "judge1" || role === "judge2") {
      const my = role === "judge1" ? j1 : j2;
      const other = role === "judge1" ? j2 : j1;

      if (none || (my === null && other !== null)) {
        info.textContent = "Not judged yet";
      } else if (my !== null && other === null) {
        info.textContent = "Waiting for other judge";
      } else if (both) {
        info.textContent = `Total: ${j1 + j2}/50 (James: ${j1}, Ananth: ${j2})`;
      }
    } else {
      if (none) info.textContent = "Not judged yet";
      else if (partial) info.textContent = "Partial judgement";
      else info.textContent = `Total: ${j1 + j2}/50`;
    }
  }
  renderInfo();

  // Judge section
  const judgeCard = document.getElementById("judgeSection");
  const whichJudge = document.getElementById("whichJudge");
  const marksInput = document.getElementById("marks");
  const submit = document.getElementById("submitMarks");

  if (role === "judge1" || role === "judge2") {
    judgeCard.classList.remove("hidden");
    whichJudge.textContent =
      role === "judge1"
        ? "You are logged in as James"
        : "You are logged in as Ananth";

    const myMark =
      role === "judge1" ? entry.marks?.j1 ?? null : entry.marks?.j2 ?? null;
    if (myMark !== null) marksInput.value = String(myMark);

    submit.onclick = () => {
      const val = parseInt(marksInput.value, 10);
      if (!Number.isNaN(val) && val >= 0 && val <= 25) {
        setMark(entry.id, role, val);
        alert(`Your mark submitted: ${val}/25`);
        renderInfo();
      } else {
        alert("Please enter a number between 0 and 25.");
      }
    };

    // Live update when other judge marks elsewhere
    window.addEventListener("storage", (e) => {
      if (e.key === ENTRIES_KEY || e.key === UPDATED_KEY) {
        renderInfo();
      }
    });
  }
})();

/*********************** Admin edit helper *****************************/
async function adminEditEntry(id, onDone) {
  const entry = getEntryById(id);
  if (!entry) return;

  const newName = prompt("Edit contestant name:", entry.name);
  if (newName === null) return;
  const newPhone = prompt("Edit WhatsApp number:", entry.phone);
  if (newPhone === null) return;

  entry.name = newName.trim() || entry.name;
  entry.phone = newPhone.trim() || entry.phone;

  if (confirm("Do you also want to replace the media file?")) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,video/*";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const t = file.type.startsWith("video")
        ? "video"
        : file.type.startsWith("audio")
        ? "audio"
        : null;
      if (!t) {
        alert("File must be audio or video.");
        return;
      }
      try {
        await idbPutBlob(entry.id, file);
        entry.type = t;
        upsertEntry(entry);
        if (typeof onDone === "function") onDone();
      } catch (err) {
        console.error(err);
        alert("Could not save the new media file.");
      }
    };
    input.click();
  } else {
    upsertEntry(entry);
    if (typeof onDone === "function") onDone();
  }
}

/*********************** UTILS ******************************************/
function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}
