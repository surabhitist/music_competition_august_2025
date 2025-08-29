/*********************** CONFIG ***************************/
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxAeX9VOhoCDLjmzfRmCqyvV4eWlqeqXTluNc0ZsqEE1XmSjcuIsrG6INo58Kl52Nsz/exec";

/*********************** ROLES + SIMPLE PINS ***************************/
const ADMIN_PIN = "ADMIN123";
const J1_PIN = "JAMES123";
const J2_PIN = "ANANTH123";

// Allow ?role=judge1 etc.
const urlRole = new URLSearchParams(location.search).get("role");
if (urlRole) localStorage.setItem("role", urlRole);
let role = localStorage.getItem("role") || "public";
let isPrivileged = role === "admin" || role === "judge1" || role === "judge2";

/*********************** COMMON UI ************************/
(function setupUI() {
  // Role selector (header)
  const rs = document.getElementById("roleSelect");
  if (rs) {
    rs.value = role;
    rs.onchange = () => {
      localStorage.setItem("role", rs.value);
      location.reload();
    };
  }

  // Judge login via PIN (header)
  const judgeLoginBtn = document.getElementById("judgeLoginBtn");
  if (judgeLoginBtn) {
    if (isPrivileged) {
      // Already logged in → hide login button
      judgeLoginBtn.classList.add("hidden");
    } else {
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

  // Logout button (header)
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

  // Judges/admins shouldn’t upload new entries
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
// Use a direct Drive URL that streams in <audio>/<video>
function getDirectMediaUrl(fileId, fallbackUrl) {
  if (fileId)
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
      fileId
    )}`;
  return fallbackUrl || "";
}

/*********************** UPLOAD PAGE **************************/
/*********************** UPLOAD PAGE **************************/
/*********************** UPLOAD PAGE **************************/
(function uploadPage() {
  // --- Make file input more visible with custom button ---
  // --- Make file input mobile-friendly with <label for="file"> ---
  const fileInput = document.getElementById("file");
  const fileName = document.getElementById("fileName");

  if (fileInput) {
    fileInput.onchange = () => {
      if (fileInput.files && fileInput.files.length > 0) {
        fileName.textContent = fileInput.files[0].name;
        fileName.classList.remove("muted");
      } else {
        fileName.textContent = "No file selected";
        fileName.classList.add("muted");
      }
    };
  }

  const form = document.getElementById("uploadForm");
  if (!form) return;

  const wrap = document.getElementById("progressWrap");
  const bar = document.getElementById("progressBar");
  const txt = document.getElementById("progressText");

  // --- success banner container ---
  const successBox = document.createElement("div");
  successBox.id = "uploadSuccessBox";
  successBox.className = "hidden";
  successBox.innerHTML = `
    <div style="
      margin: 30px auto; 
      padding: 20px; 
      max-width: 400px; 
      background:#1f4337; 
      color:#73f0c6; 
      border:2px solid #20c997; 
      border-radius:12px; 
      text-align:center; 
      font-size:18px; 
      font-weight:600;
      box-shadow:0 4px 14px rgba(0,0,0,0.4);
    ">
      ✅ Upload successful!…
    </div>`;
  form.parentNode.insertBefore(successBox, form.nextSibling);

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

      bar.style.width = "70%";
      txt.textContent = "Processing…";
      const ok = await waitForPhone(phone);
      if (!ok) throw new Error("Upload did not complete. Please try again.");

      // ✅ CLEAR SUCCESS MESSAGE
      wrap.classList.add("hidden");
      successBox.classList.remove("hidden");

      setTimeout(() => {
        window.location.href = "view.html";
      }, 2000);
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
/*********************** CONTESTANT PAGE *****************************/
/*********************** CONTESTANT PAGE *****************************/
/*********************** CONTESTANT PAGE *****************************/
/*********************** CONTESTANT PAGE *****************************/
/*********************** CONTESTANT PAGE *****************************/
/*********************** CONTESTANT PAGE (stable, no flicker) *****************************/
/*********************** CONTESTANT PAGE (stable, clean) *****************************/
(function contestantPage() {
  const container = document.getElementById("contestantDetails");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  // Helpers
  const driveDl = (fid) =>
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fid)}`;
  const drivePrev = (fid) =>
    `https://drive.google.com/file/d/${encodeURIComponent(fid)}/preview`;
  const inferKind = (entry, src) => {
    if (entry.type === "video" || entry.type === "audio") return entry.type;
    const u = (src || "").toLowerCase();
    if (/\.(mp4|webm|mov|m4v|3gp)(\?|$)/.test(u)) return "video";
    if (/\.(mp3|wav|m4a|aac|ogg|oga)(\?|$)/.test(u)) return "audio";
    return "audio";
  };

  let infoP, whichJudge, marksInput, submitBtn, judgeCard, mediaMount;
  let mediaInitialized = false;
  let lastEntryJson = "";

  async function initOnce() {
    const resp = await gasGet();
    if (!resp.ok) {
      container.innerHTML = "<p class='muted'>Could not load.</p>";
      return null;
    }
    const e = (resp.entries || []).find((x) => x.id === id);
    if (!e) {
      container.innerHTML = "<p class='muted'>Entry not found.</p>";
      return null;
    }

    const fileId = e.fileId || "";
    const primarySrc = fileId ? driveDl(fileId) : e.fileUrl || "";
    const kind = inferKind(e, primarySrc);

    container.innerHTML = `
      <h2>${escapeHtml(e.name)}</h2>
      <p><strong>WhatsApp:</strong> ${escapeHtml(String(e.phone || ""))}</p>
      <div id="embedHere" style="margin-top:12px;"></div>
    `;

    mediaMount = document.getElementById("embedHere");

    // --- Try native media first; fallback to Drive preview iframe once ---
    const mountNative = () => {
      let el;
      if (kind === "video") {
        el = document.createElement("video");
        el.controls = true;
        el.playsInline = true;
        el.preload = "metadata";
        el.src = primarySrc;
        el.style.maxWidth = "100%";
        el.style.height = "auto";
        el.style.borderRadius = "8px";
      } else {
        el = document.createElement("audio");
        el.controls = true;
        el.preload = "metadata";
        el.src = primarySrc;
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
      mediaMount.innerHTML = "";
      mediaMount.appendChild(el);
    };

    const mountIframe = () => {
      if (!fileId) return;
      const iframe = document.createElement("iframe");
      iframe.src = drivePrev(fileId);
      iframe.style.width = "100%";
      iframe.style.border = "0";
      iframe.allow = "autoplay; encrypted-media";
      iframe.style.height = kind === "video" ? "360px" : "120px";
      mediaMount.innerHTML = "";
      mediaMount.appendChild(iframe);
    };

    mountNative();

    // Build status paragraph
    infoP = document.createElement("p");
    container.appendChild(infoP);

    // Judge panel references (already present in HTML)
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
            id: e.id,
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

    mediaInitialized = true;
    await refreshMarksOnly(e);
    return e;
  }

  async function refreshMarksOnly(existing) {
    let e = existing;
    if (!e) {
      const resp = await gasGet();
      if (!resp.ok) return;
      e = (resp.entries || []).find((x) => x.id === id);
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
    if (mediaInitialized) setInterval(refreshMarksOnly, 5000);
  })();
})();
