/*********************** CONFIG ***************************/
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxWMNEETGgij-cPBn_DJOYJtgX4IoYz0YiEsGkKwMPK4kwrPhvO0D45TwCKxdZuj9KI/exec";

/*********************** ROLES + PINS ***************************/
const ADMIN_PIN = "ADMIN123";
const J1_PIN = "JAMES123";
const J2_PIN = "ANANTH123";

// Allow ?role=judge1 for quick testing
const urlRole = new URLSearchParams(location.search).get("role");
if (urlRole) localStorage.setItem("role", urlRole);
let role = localStorage.getItem("role") || "public";
let isPrivileged = role === "admin" || role === "judge1" || role === "judge2";

/*********************** COMMON UI ************************/
/*********************** COMMON UI ************************/
/*********************** ROLES + PINS ***************************/
const ADMIN_PIN = "Karukayil123!@#";
const J1_PIN = "Karukayil123!@#";
const J2_PIN = "Karukayil123!@#";

/*********************** COMMON UI ************************/
(function setupUI() {
  // URL override once (e.g. ?role=admin for testing)
  const urlRole = new URLSearchParams(location.search).get("role");
  if (urlRole) localStorage.setItem("role", urlRole);

  window.role = localStorage.getItem("role") || "public";
  window.isPrivileged =
    role === "admin" || role === "judge1" || role === "judge2";

  // --- Helpers to make mobile inputs robust ---
  const sanitizePin = (s) => {
    // Normalize Unicode, remove all whitespace (incl. zero-width/non-breaking)
    // and strip direction/invisible control chars
    return String(s || "")
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF\u2060\u00A0\s]/g, ""); // zero-width, NBSP, any whitespace
  };
  const eqPin = (input, target) => sanitizePin(input) === sanitizePin(target);

  // --- Modal wiring ---
  const modal = document.getElementById("pinModal");
  const pinIn = document.getElementById("pinInput");
  const pinOk = document.getElementById("pinSubmit");
  const pinNo = document.getElementById("pinCancel");
  const pinErr = document.getElementById("pinError");

  function openPin() {
    if (!modal) return fallbackPrompt();
    pinErr && pinErr.classList.add("hidden");
    pinIn && (pinIn.value = "");
    modal.classList.remove("hidden");
    // focus after paint for some mobile UAs
    setTimeout(() => {
      try {
        pinIn && pinIn.focus();
      } catch (_) {}
    }, 50);
  }
  function closePin() {
    modal && modal.classList.add("hidden");
  }
  function fallbackPrompt() {
    const entered = prompt("Enter Judge/Admin PIN:");
    if (entered === null) return;
    handlePin(entered);
  }
  function handlePin(entered) {
    // Compare against all three roles (same PIN in your case)
    let newRole = null;
    if (eqPin(entered, ADMIN_PIN)) newRole = "admin";
    else if (eqPin(entered, J1_PIN)) newRole = "judge1";
    else if (eqPin(entered, J2_PIN)) newRole = "judge2";

    if (!newRole) {
      if (pinErr) pinErr.classList.remove("hidden");
      else alert("Invalid PIN");
      return;
    }
    localStorage.setItem("role", newRole);
    // Hide login button immediately and reload UI
    const judgeLoginBtn = document.getElementById("judgeLoginBtn");
    if (judgeLoginBtn) judgeLoginBtn.classList.add("hidden");
    closePin();
    location.reload();
  }

  if (pinOk) pinOk.onclick = () => handlePin(pinIn ? pinIn.value : "");
  if (pinNo) pinNo.onclick = closePin;
  if (pinIn)
    pinIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handlePin(pinIn.value);
    });

  // --- Judge/Admin login button ---
  const judgeLoginBtn = document.getElementById("judgeLoginBtn");
  if (judgeLoginBtn) {
    if (isPrivileged) {
      judgeLoginBtn.classList.add("hidden");
    } else {
      judgeLoginBtn.classList.remove("hidden");
      judgeLoginBtn.onclick = openPin;
    }
  }

  // --- Logout button ---
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

  // --- Hide upload links for judges/admins ---
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

// Drive URL helpers
const driveDl = (fid) =>
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fid)}`;
const drivePrev = (fid) =>
  `https://drive.google.com/file/d/${encodeURIComponent(fid)}/preview`;

function extractFileIdFromUrl(u) {
  if (!u) return "";
  const s = String(u);
  // /file/d/<ID>/
  let m = s.match(/\/file\/d\/([^/]+)/i);
  if (m && m[1]) return m[1];
  // ?id=<ID>
  m = s.match(/[?&]id=([^&]+)/i);
  if (m && m[1]) return m[1];
  // uc?export=download&id=<ID>
  m = s.match(/[?&]id=([^&]+)/i);
  if (m && m[1]) return m[1];
  return "";
}

/*********************** UPLOAD PAGE **************************/
(function uploadPage() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  const wrap = document.getElementById("progressWrap");
  const bar = document.getElementById("progressBar");
  const txt = document.getElementById("progressText");

  function showUploadSuccessAndRedirect() {
    let successBox = document.getElementById("uploadSuccessBox");
    if (!successBox) {
      successBox = document.createElement("div");
      successBox.id = "uploadSuccessBox";
      successBox.innerHTML = `
        <div style="
          margin: 30px auto; padding: 20px; max-width: 420px;
          background:#1f4337; color:#73f0c6; border:2px solid #20c997;
          border-radius:12px; text-align:center; font-size:18px; font-weight:600;
          box-shadow:0 4px 14px rgba(0,0,0,0.4);
        ">
          ✅ Upload successful!<br/>Redirecting to <strong>View Songs</strong>…
        </div>`;
      form.parentNode.insertBefore(successBox, form.nextSibling);
    }
    successBox.classList.remove("hidden");
    form.reset();
    setTimeout(() => {
      window.location.href = "view.html";
    }, 1800);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector("button[type=submit]");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("disabled");
      btn.textContent = "Uploading…";
    }

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

      // Duplicate check
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

      wrap.classList.remove("hidden");
      bar.style.width = "25%";
      txt.textContent = "Preparing upload…";

      const fd = new FormData();
      fd.set("action", "upload");
      fd.set("name", name);
      fd.set("phone", phone);
      fd.set("filename", file.name);
      fd.set("type", type);
      fd.set("file", file);

      bar.style.width = "55%";
      txt.textContent = "Uploading…";

      await fetch(GAS_URL, { method: "POST", mode: "no-cors", body: fd });

      const isVideo = type.startsWith("video");
      const timeoutMs = isVideo ? 180000 : 45000;
      const stepMs = 1500;

      bar.style.width = "75%";
      txt.textContent = isVideo
        ? "Processing video… this can take 1–3 minutes. Please wait…"
        : "Processing…";

      const ok = await (async function waitForPhone(phone, timeout, step) {
        const key = phone.trim();
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
          const res = await gasGet();
          if (res.ok && Array.isArray(res.entries)) {
            if (res.entries.some((x) => String(x.phone || "").trim() === key))
              return true;
          }
          await new Promise((r) => setTimeout(r, step));
        }
        return false;
      })(phone, timeoutMs, stepMs);

      if (!ok) throw new Error("Upload did not complete. Please try again.");

      wrap.classList.add("hidden");
      showUploadSuccessAndRedirect();
    } catch (err) {
      alert(err.message || "Upload failed. Please try again.");
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("disabled");
        btn.textContent = "Upload";
      }
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
        try {
          sessionStorage.setItem("lastContestantId", String(e.id));
        } catch (_) {}
        window.location.href = `contestant.html?id=${encodeURIComponent(
          String(e.id)
        )}`;
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
            id: String(e.id),
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
            const r = await postForm({ action: "delete", id: String(e.id) });
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

/*********************** CONTESTANT PAGE (mobile-proof, stable embed) *****************************/
(function contestantPage() {
  const container = document.getElementById("contestantDetails");
  if (!container) return;

  function resolveContestantId() {
    // 1) querystring ?id=...
    try {
      const params = new URLSearchParams(window.location.search);
      const qid = params.get("id");
      if (qid && qid.trim()) return decodeURIComponent(qid).trim();
    } catch (_) {}
    // 2) hash #id=...
    try {
      const h = String(window.location.hash || "");
      const m = h.match(/[#&?]id=([^&]+)/i);
      if (m && m[1]) return decodeURIComponent(m[1]).trim();
    } catch (_) {}
    // 3) path /contestant.html/123 or /contestant/123
    try {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || "";
      const pm = last.match(/^(\d+|[A-Za-z0-9\-\_]+)$/);
      if (pm && pm[1]) return decodeURIComponent(pm[1]).trim();
    } catch (_) {}
    // 4) sessionStorage fallback
    try {
      const sid = sessionStorage.getItem("lastContestantId");
      if (sid && sid.trim()) return sid.trim();
    } catch (_) {}
    return null;
  }

  const id = resolveContestantId();
  if (!id) {
    container.innerHTML =
      "<p class='muted'>Entry not found (no id provided). Please open from the View Songs page.</p>";
    return;
  }

  const inferKind = (entry, src) => {
    if (entry.type === "video" || entry.type === "audio") return entry.type;
    const u = (src || "").toLowerCase();
    if (/\.(mp4|webm|mov|m4v|3gp)(\?|$)/.test(u)) return "video";
    if (/\.(mp3|wav|m4a|aac|ogg|oga)(\?|$)/.test(u)) return "audio";
    return "audio";
  };

  // Drive helpers
  const driveDl = (fid) =>
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fid)}`;
  const drivePrev = (fid) =>
    `https://drive.google.com/file/d/${encodeURIComponent(fid)}/preview`;
  function extractFileIdFromUrl(u) {
    if (!u) return "";
    const s = String(u);
    let m = s.match(/\/file\/d\/([^/]+)/i);
    if (m && m[1]) return m[1];
    m = s.match(/[?&]id=([^&]+)/i);
    if (m && m[1]) return m[1];
    return "";
  }

  let infoP, whichJudge, marksInput, submitBtn, judgeCard, mediaMount;
  let lastEntryJson = "";

  async function initOnce() {
    const resp = await gasGet();
    if (!resp.ok) {
      container.innerHTML = "<p class='muted'>Could not load.</p>";
      return null;
    }
    const e = (resp.entries || []).find((x) => String(x.id) === String(id));
    if (!e) {
      container.innerHTML = "<p class='muted'>Entry not found.</p>";
      return null;
    }

    let fileId = String(e.fileId || "").trim();
    if (!fileId && e.fileUrl) fileId = extractFileIdFromUrl(e.fileUrl);
    if (!fileId) {
      container.innerHTML = `
        <h2>${escapeHtml(e.name)}</h2>
        <p><strong>WhatsApp:</strong> ${escapeHtml(String(e.phone || ""))}</p>
        <p class="muted">This entry has no valid Drive file ID. Please update the sheet’s <em>fileId</em> column.</p>
      `;
      return null;
    }

    const html5Src = driveDl(fileId); // for native <video>/<audio>
    const iframeSrc = drivePrev(fileId); // Drive preview fallback
    const kind = inferKind(e, e.fileUrl || "");

    container.innerHTML = `
      <h2>${escapeHtml(e.name)}</h2>
      <p><strong>WhatsApp:</strong> ${escapeHtml(String(e.phone || ""))}</p>
      <div id="embedHere" style="margin-top:12px;"></div>
    `;

    const mediaMountEl = document.getElementById("embedHere");

    // Try native media first; if it doesn't load quickly, fallback once to Drive preview
    const mountNative = () => {
      let el;
      if (kind === "video") {
        el = document.createElement("video");
        el.controls = true;
        el.playsInline = true;
        el.preload = "metadata";
        el.src = html5Src;
        el.style.maxWidth = "100%";
        el.style.height = "auto";
        el.style.borderRadius = "8px";
      } else {
        el = document.createElement("audio");
        el.controls = true;
        el.preload = "metadata";
        el.src = html5Src;
      }
      let loaded = false;
      el.addEventListener(
        "loadedmetadata",
        () => {
          loaded = true;
        },
        { once: true }
      );
      el.addEventListener(
        "error",
        () => {
          if (!loaded) mountIframe();
        },
        { once: true }
      );
      setTimeout(() => {
        if (!loaded) mountIframe();
      }, 2000);
      mediaMountEl.innerHTML = "";
      mediaMountEl.appendChild(el);
    };

    const mountIframe = () => {
      const iframe = document.createElement("iframe");
      iframe.src = iframeSrc;
      iframe.style.width = "100%";
      iframe.style.border = "0";
      iframe.allow = "autoplay; encrypted-media";
      iframe.style.height = kind === "video" ? "360px" : "120px";
      mediaMountEl.innerHTML = "";
      mediaMountEl.appendChild(iframe);
    };

    mountNative();

    // Build status paragraph
    infoP = document.createElement("p");
    container.appendChild(infoP);

    // Judge panel
    judgeCard = document.getElementById("judgeSection");
    whichJudge = document.getElementById("whichJudge");
    marksInput = document.getElementById("marks");
    submitBtn = document.getElementById("submitMarks");

    if (role === "judge1" || role === "judge2") {
      judgeCard.classList.remove("hidden");
      whichJudge.textContent =
        role === "judge1"
          ? "You are logged in as James"
          : "You are logged in as Ananth";
      if (submitBtn) {
        submitBtn.onclick = async () => {
          const val = parseInt(marksInput.value, 10);
          if (Number.isNaN(val) || val < 0 || val > 25) {
            alert("Please enter a number between 0 and 25.");
            return;
          }
          submitBtn.disabled = true;
          submitBtn.classList.add("disabled");
          submitBtn.textContent = "Saving…";
          const r = await postForm({
            action: "mark",
            id: String(e.id),
            judge: role,
            value: val,
          });
          if (!r.ok) alert(r.error || "Could not save your mark.");
          else alert(`Your mark submitted: ${val}/25`);
          submitBtn.disabled = false;
          submitBtn.classList.remove("disabled");
          submitBtn.textContent = "Submit mark";
          await refreshMarksOnly();
        };
      }
    }

    await refreshMarksOnly(e);
    return e;
  }

  async function refreshMarksOnly(existing) {
    let e = existing;
    if (!e) {
      const resp = await gasGet();
      if (!resp.ok) return;
      e = (resp.entries || []).find((x) => String(x.id) === String(id));
      if (!e) return;
    }

    const sig = JSON.stringify({
      j1: e.marks?.j1 ?? null,
      j2: e.marks?.j2 ?? null,
    });
    if (sig === lastEntryJson && infoP) return;
    lastEntryJson = sig;

    const j1 = e.marks?.j1 ?? null,
      j2 = e.marks?.j2 ?? null;
    const both = j1 !== null && j2 !== null,
      none = j1 === null && j2 === null,
      partial = !both && !none;

    if (infoP) {
      if (role === "judge1" || role === "judge2") {
        infoP.textContent = none
          ? "Not judged yet"
          : (role === "judge1" ? j1 : j2) !== null &&
            (role === "judge1" ? j2 : j1) === null
          ? "Waiting for other judge"
          : both
          ? `Total: ${j1 + j2}/50 (James: ${j1}, Ananth: ${j2})`
          : "Not judged yet";
      } else {
        infoP.textContent = none
          ? "Not judged yet"
          : partial
          ? "Partial judgement"
          : `Total: ${j1 + j2}/50`;
      }
    }

    if (
      (role === "judge1" || role === "judge2") &&
      marksInput &&
      document.activeElement !== marksInput
    ) {
      const my = role === "judge1" ? j1 ?? "" : j2 ?? "";
      marksInput.value = my === "" ? "" : String(my);
    }
  }

  (async () => {
    await initOnce();
    // refresh marks periodically (media is static)
    setInterval(refreshMarksOnly, 5000);
  })();
})();
