/*********************** CONFIG ***************************/
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxAeX9VOhoCDLjmzfRmCqyvV4eWlqeqXTluNc0ZsqEE1XmSjcuIsrG6INo58Kl52Nsz/exec";

/*********************** ROLES + SIMPLE PINS ***************************/
const ADMIN_PIN = "ADMIN123";
const J1_PIN = "JAMES123";
const J2_PIN = "ANANTH123";

const urlRole = new URLSearchParams(location.search).get("role");
if (urlRole) localStorage.setItem("role", urlRole);
let role = localStorage.getItem("role") || "public";
let isPrivileged = role === "admin" || role === "judge1" || role === "judge2";

/*********************** COMMON UI ************************/
(function setupUI() {
  const rs = document.getElementById("roleSelect");
  if (rs) {
    rs.value = role;
    rs.onchange = () => {
      localStorage.setItem("role", rs.value);
      location.reload();
    };
  }

  // Judge login via PIN
  const judgeLoginBtn = document.getElementById("judgeLoginBtn");
  if (judgeLoginBtn) {
    if (isPrivileged) {
      // Already logged in → hide login button
      judgeLoginBtn.classList.add("hidden");
    } else {
      // Not logged in → show login button
      judgeLoginBtn.classList.remove("hidden");
      judgeLoginBtn.onclick = () => {
        const pin = prompt("Enter Judge/Admin PIN:");
        if (pin === null) return;
        let newRole = null;
        if (pin === ADMIN_PIN) newRole = "admin";
        else if (pin === J1_PIN) newRole = "judge1";
        else if (pin === J2_PIN) newRole = "judge2";
        if (!newRole) {
          alert("Invalid PIN");
          return;
        }
        localStorage.setItem("role", newRole);
        location.reload();
      };
    }
  }

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    if (isPrivileged) {
      logoutBtn.classList.remove("hidden");
      logoutBtn.onclick = () => {
        localStorage.removeItem("role");
        alert("Logged out.");
        window.location.href = "index.html";
      };
    } else {
      logoutBtn.classList.add("hidden");
    }
  }

  // Hide Upload links for judges/admins
  if (isPrivileged) {
    const up1 = document.getElementById("uploadLink");
    const up2 = document.getElementById("uploadLinkView");
    if (up1) up1.style.display = "none";
    if (up2) up2.style.display = "none";
    if (location.pathname.endsWith("upload.html"))
      window.location.replace("view.html");
  }
})();

/*********************** HELPERS **************************/
function escapeHtml(s) {
  return String(s).replace(
    /[&<>\"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}
async function gasGet() {
  try {
    const r = await fetch(GAS_URL);
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// FORM-ENC POST (avoids CORS preflight)
async function postForm(paramsObj) {
  const params = new URLSearchParams();
  for (const k in paramsObj) params.set(k, String(paramsObj[k]));
  const resp = await fetch(GAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: params.toString(),
  });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Bad JSON from server" };
  }
}

function sortEntries(rows) {
  return rows.slice().sort((a, b) => {
    const j1a = a.marks?.j1 ?? null,
      j2a = a.marks?.j2 ?? null;
    const j1b = b.marks?.j1 ?? null,
      j2b = b.marks?.j2 ?? null;
    const bothA = j1a !== null && j2a !== null,
      bothB = j1b !== null && j2b !== null;
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
}

/*********************** UPLOAD PAGE **************************/
(function uploadPage() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  const wrap = document.getElementById("progressWrap");
  const bar = document.getElementById("progressBar");
  const txt = document.getElementById("progressText");

  async function waitForPhone(phone, timeoutMs = 30000, stepMs = 1500) {
    const phoneKey = phone.trim();
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const res = await gasGet();
      if (res.ok && Array.isArray(res.entries)) {
        if (res.entries.some((x) => String(x.phone || "").trim() === phoneKey))
          return true;
      }
      await new Promise((r) => setTimeout(r, stepMs));
    }
    return false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("cname").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const file = document.getElementById("file").files[0];

    try {
      if (!name) throw new Error("Please enter your name.");
      if (!/^[0-9+\-\s]{8,15}$/.test(phone))
        throw new Error("Please enter a valid WhatsApp number.");
      if (!file) throw new Error("Please select an audio or video file.");

      const type = file.type || "application/octet-stream";
      if (!(type.startsWith("audio") || type.startsWith("video")))
        throw new Error("File must be audio or video.");
      const MAX = 50 * 1024 * 1024;
      if (file.size > MAX)
        throw new Error("File too large. Please upload under 50 MB.");

      // duplicate check
      const list = await gasGet();
      if (
        list.ok &&
        Array.isArray(list.entries) &&
        list.entries.some((x) => String(x.phone || "").trim() === phone.trim())
      ) {
        throw new Error(
          "This phone number already has an entry. Please use a different number."
        );
      }

      // read base64
      wrap.classList.remove("hidden");
      bar.style.width = "10%";
      txt.textContent = "Reading file…";
      const base64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error || new Error("File read error"));
        fr.onload = () => {
          const s = String(fr.result);
          const i = s.indexOf(",");
          resolve(i >= 0 ? s.slice(i + 1) : s);
        };
        fr.readAsDataURL(file);
      });

      // upload (no-cors keeps it simple; we confirm via GET)
      bar.style.width = "40%";
      txt.textContent = "Uploading…";
      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({
          action: "upload_b64",
          name,
          phone,
          filename: file.name,
          type,
          data: base64,
        }).toString(),
      });

      // confirm
      bar.style.width = "70%";
      txt.textContent = "Processing…";
      const ok = await waitForPhone(phone);
      if (!ok) throw new Error("Upload did not complete. Please try again.");

      bar.style.width = "100%";
      txt.textContent = "100%";
      setTimeout(() => {
        window.location.href = "view.html";
      }, 400);
    } catch (err) {
      alert(err.message || "Upload failed. Please try again.");
      if (wrap) {
        bar.style.width = "0%";
        txt.textContent = "0%";
      }
    }
  });
})();

/*********************** VIEW PAGE **************************/
(function viewPage() {
  const tableEl = document.getElementById("songsTable");
  const bodyEl = document.getElementById("songsBody");
  const modeEl = document.getElementById("viewMode");
  if (!tableEl || !bodyEl) return;

  if (modeEl) {
    modeEl.textContent =
      role === "admin"
        ? "Admin"
        : role === "judge1"
        ? "James"
        : role === "judge2"
        ? "Ananth"
        : "Public";
  }

  // Hide Actions header for non-admins
  if (role !== "admin" && tableEl.tHead && tableEl.tHead.rows.length) {
    const lastTh = tableEl.tHead.rows[0].lastElementChild;
    if (lastTh && lastTh.dataset && lastTh.dataset.actions === "1")
      lastTh.remove();
  }

  function statusText(e) {
    const j1 = e.marks?.j1 ?? null,
      j2 = e.marks?.j2 ?? null;
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

  async function loadAndRender() {
    const resp = await gasGet();

    if (!resp.ok) {
      bodyEl.innerHTML = `
        <tr><td colspan="${role === "admin" ? 5 : 4}" class="center">
          <span class="badge err">Could not load entries</span>
        </td></tr>`;
      return;
    }

    const entries = Array.isArray(resp.entries) ? resp.entries : [];
    if (!entries.length) {
      bodyEl.innerHTML = `
        <tr><td colspan="${role === "admin" ? 5 : 4}" class="center">
          <span class="badge gray">No entries yet</span>
        </td></tr>`;
      return;
    }

    const sorted = sortEntries(entries);
    bodyEl.innerHTML = "";
    sorted.forEach((e, i) => {
      const tr = document.createElement("tr");
      tr.className = "clickable";
      tr.onclick = () => {
        window.location.href = `contestant.html?id=${encodeURIComponent(e.id)}`;
      };

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(i + 1);
      const tdNm = document.createElement("td");
      tdNm.innerHTML = `<strong>${escapeHtml(e.name)}</strong>`;
      const tdPh = document.createElement("td");
      tdPh.textContent = String(e.phone || "");
      const tdSt = document.createElement("td");
      tdSt.innerHTML = statusText(e);

      tr.append(tdIdx, tdNm, tdPh, tdSt);

      if (role === "admin") {
        const tdAct = document.createElement("td");
        const btnE = document.createElement("button");
        btnE.className = "btn";
        btnE.textContent = "Edit";
        btnE.style.marginRight = "6px";
        btnE.onclick = async (ev) => {
          ev.stopPropagation();
          const newName = prompt("Edit contestant name:", e.name);
          if (newName === null) return;
          const newPhone = prompt(
            "Edit WhatsApp number:",
            String(e.phone || "")
          );
          if (newPhone === null) return;
          const r = await postForm({
            action: "edit",
            id: e.id,
            name: newName.trim(),
            phone: newPhone.trim(),
          });
          if (!r.ok) alert(r.error || "Edit failed");
          else loadAndRender();
        };
        const btnD = document.createElement("button");
        btnD.className = "btn";
        btnD.textContent = "Delete";
        btnD.onclick = async (ev) => {
          ev.stopPropagation();
          if (confirm("Delete this entry?")) {
            const r = await postForm({ action: "delete", id: e.id });
            if (!r.ok) alert(r.error || "Delete failed");
            else loadAndRender();
          }
        };
        tdAct.append(btnE, btnD);
        tr.appendChild(tdAct);
      }

      bodyEl.appendChild(tr);
    });
  }

  loadAndRender();
  setInterval(loadAndRender, 5000);
})();

/*********************** CONTESTANT PAGE *****************************/
(function contestantPage() {
  const container = document.getElementById("contestantDetails");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const info = document.createElement("p");
  container.appendChild(info);

  async function render() {
    const resp = await gasGet();
    if (!resp.ok) {
      container.innerHTML = "<p class='muted'>Could not load.</p>";
      return;
    }
    const e = resp.entries.find((x) => x.id === id);
    if (!e) {
      container.innerHTML = "<p class='muted'>Entry not found.</p>";
      return;
    }

    container.innerHTML = `
      <h2>${escapeHtml(e.name)}</h2>
      <p><strong>WhatsApp:</strong> ${escapeHtml(String(e.phone || ""))}</p>
    `;

    const mediaWrap = document.createElement("div");
    if (e.type === "video") {
      const v = document.createElement("video");
      v.controls = true;
      v.playsInline = true;
      v.src = e.fileUrl;
      v.style.maxWidth = "100%";
      v.style.height = "auto";
      v.style.borderRadius = "8px";
      mediaWrap.appendChild(v);
    } else {
      const a = document.createElement("audio");
      a.controls = true;
      a.src = e.fileUrl;
      mediaWrap.appendChild(a);
    }
    container.appendChild(mediaWrap);

    const j1 = e.marks?.j1 ?? null,
      j2 = e.marks?.j2 ?? null;
    const both = j1 !== null && j2 !== null,
      none = j1 === null && j2 === null,
      partial = !both && !none;

    if (role === "judge1" || role === "judge2") {
      info.textContent = none
        ? "Not judged yet"
        : (role === "judge1" ? j1 : j2) !== null &&
          (role === "judge1" ? j2 : j1) === null
        ? "Waiting for other judge"
        : both
        ? `Total: ${j1 + j2}/50 (James: ${j1}, Ananth: ${j2})`
        : "Not judged yet";
    } else {
      info.textContent = none
        ? "Not judged yet"
        : partial
        ? "Partial judgement"
        : `Total: ${j1 + j2}/50`;
    }
    container.appendChild(info);

    // Judges panel
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
      const myMark = role === "judge1" ? j1 ?? null : j2 ?? null;
      if (myMark !== null) marksInput.value = String(myMark);

      submit.onclick = async () => {
        const val = parseInt(marksInput.value, 10);
        if (Number.isNaN(val) || val < 0 || val > 25) {
          alert("Please enter a number between 0 and 25.");
          return;
        }
        const r = await postForm({
          action: "mark",
          id: e.id,
          judge: role,
          value: val,
        });
        if (!r.ok) {
          alert(r.error || "Could not save your mark.");
          return;
        }
        alert(`Your mark submitted: ${val}/25`);
        render();
      };
    }
  }

  render();
  setInterval(render, 5000);
})();
