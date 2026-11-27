(function () {
  "use strict";
  var KEY = "studied-v1";
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  var studied = load();

  // Theme
  var themeBtn = document.getElementById("themeBtn");
  themeBtn && themeBtn.addEventListener("click", function () {
    var cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
  });

  // Mobile menu
  var menuBtn = document.getElementById("menuBtn"), scrim = document.getElementById("scrim");
  function setNav(open) { document.body.classList.toggle("nav-open", open); menuBtn && menuBtn.setAttribute("aria-expanded", open); }
  menuBtn && menuBtn.addEventListener("click", function () { setNav(!document.body.classList.contains("nav-open")); });
  scrim && scrim.addEventListener("click", function () { setNav(false); });
  document.querySelectorAll(".side a").forEach(function (a) { a.addEventListener("click", function () { setNav(false); }); });
  var cur = document.querySelector(".side li.current");
  cur && cur.scrollIntoView({ block: "center" });

  // Studied tracking on course pages
  var course = document.querySelector(".course");
  if (course) {
    var cid = course.dataset.course;
    var btns = course.querySelectorAll(".done-btn");
    function refresh() {
      var set = studied[cid] || {}, n = 0;
      btns.forEach(function (b) {
        var d = !!set[b.dataset.unit]; if (d) n++;
        b.classList.toggle("is-done", d);
        b.textContent = d ? "Studied" : "Mark as studied";
        var t = document.querySelector('[data-tick="' + b.dataset.unit + '"]'); t && t.classList.toggle("done", d);
        var s = document.querySelector('[data-toc="' + b.dataset.unit + '"]'); s && s.classList.toggle("done", d);
      });
      var pct = btns.length ? Math.round(100 * n / btns.length) : 0;
      document.getElementById("pbar").style.width = pct + "%";
      document.getElementById("ptext").textContent = n + " of " + btns.length + " chapters studied";
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var set = studied[cid] || (studied[cid] = {});
        if (set[b.dataset.unit]) delete set[b.dataset.unit]; else set[b.dataset.unit] = 1;
        save(studied); refresh();
      });
    });
    refresh();

    // Scroll spy for sidebar chapter list
    var heads = Array.prototype.slice.call(course.querySelectorAll(".prose h1"));
    var links = {};
    document.querySelectorAll("[data-toc]").forEach(function (a) { links[a.dataset.toc] = a; });
    var toTop = document.getElementById("toTop");
    var ticking = false;
    function spy() {
      ticking = false;
      var y = window.scrollY + 120, on = null;
      for (var i = 0; i < heads.length; i++) { if (heads[i].offsetTop <= y) on = heads[i].id; else break; }
      Object.keys(links).forEach(function (k) { links[k].classList.toggle("on", k === on); });
      toTop && toTop.classList.toggle("show", window.scrollY > 800);
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    toTop && toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    spy();
  }

  // Home progress
  var cards = document.querySelectorAll(".card[data-units]");
  if (cards.length) {
    var total = 0;
    cards.forEach(function (c) {
      var ids = c.dataset.units ? c.dataset.units.split(",") : [], set = studied[c.dataset.course] || {}, n = 0;
      ids.forEach(function (i) { if (set[i]) n++; });
      total += n;
      c.querySelector(".bar span").style.width = (ids.length ? 100 * n / ids.length : 0) + "%";
      if (n) c.querySelector(".ctext").textContent = n + " / " + ids.length + " studied";
    });
    var dc = document.getElementById("doneCount"); dc && (dc.textContent = total);
  }

  // Search
  var q = document.getElementById("q"), box = document.getElementById("results"), index = null, loading = null;
  function getIndex() {
    if (index) return Promise.resolve(index);
    if (!loading) loading = fetch("assets/search.json").then(function (r) { return r.json(); }).then(function (d) {
      d.forEach(function (r) { r._l = (r.t + " " + r.x).toLowerCase(); r._t = r.t.toLowerCase(); });
      return (index = d);
    });
    return loading;
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hl(s, terms) {
    var out = esc(s);
    terms.forEach(function (t) { if (t.length > 1) out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>"); });
    return out;
  }
  var active = -1;
  function run() {
    var v = q.value.trim().toLowerCase();
    if (v.length < 2) { box.hidden = true; return; }
    getIndex().then(function (d) {
      var terms = v.split(/\s+/).filter(Boolean), hits = [];
      for (var i = 0; i < d.length; i++) {
        var r = d[i], ok = true, score = 0;
        for (var j = 0; j < terms.length; j++) {
          if (r._l.indexOf(terms[j]) < 0) { ok = false; break; }
          if (r._t.indexOf(terms[j]) >= 0) score += 10;
        }
        if (ok) { if (r._l.indexOf(v) >= 0) score += 5; hits.push([score, r]); }
      }
      hits.sort(function (a, b) { return b[0] - a[0]; });
      hits = hits.slice(0, 30);
      if (!hits.length) { box.innerHTML = '<div class="r-empty">No matches for “' + esc(q.value) + '”.</div>'; box.hidden = false; return; }
      box.innerHTML = hits.map(function (h) {
        var r = h[1], pos = r.x.toLowerCase().indexOf(terms[0]), start = Math.max(0, pos - 60);
        var snip = (start ? "…" : "") + r.x.substr(start, 170) + "…";
        var where = r.c + (r.u && r.u !== r.t ? " · " + r.u : "");
        return '<a href="' + r.p + "#" + r.a + '"><div class="r-where">' + esc(where) + '</div><div class="r-title">' + hl(r.t, terms) + '</div><div class="r-snip">' + hl(snip, terms) + "</div></a>";
      }).join("");
      box.hidden = false; active = -1;
    });
  }
  if (q) {
    var tmr;
    q.addEventListener("input", function () { clearTimeout(tmr); tmr = setTimeout(run, 150); });
    q.addEventListener("focus", function () { getIndex(); if (q.value.trim().length > 1) run(); });
    q.addEventListener("keydown", function (e) {
      var items = box.querySelectorAll("a");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!items.length) return;
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.classList.toggle("active", i === active); });
        items[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") { if (items.length) (items[active >= 0 ? active : 0]).click(); }
      else if (e.key === "Escape") { box.hidden = true; q.blur(); }
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".search")) box.hidden = true; });
    box.addEventListener("click", function () { box.hidden = true; });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== q && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
    });
  }

  // MCQ practice
  var quiz = document.getElementById("quiz");
  if (quiz) {
    var sel = document.getElementById("prCourse"), scoreEl = document.getElementById("prScore");
    var all = [], pool = [], right = 0, done = 0;
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function reset() {
      pool = shuffle(all.filter(function (m) { return !sel.value || m.p === sel.value; }).slice());
      right = 0; done = 0; score(); next();
    }
    function score() { scoreEl.textContent = "Score " + right + " / " + done; }
    function next() {
      if (!pool.length) {
        quiz.innerHTML = '<div class="qcard"><p class="qtext">Round finished: ' + right + " of " + done + ' correct.</p><button class="btn" id="again">Start again</button></div>';
        document.getElementById("again").onclick = reset; return;
      }
      var m = pool.pop(), L = "abcde";
      quiz.innerHTML = '<div class="qcard"><div class="qsrc">' + esc(m.code) + ' · <a href="' + m.p + '#exam-preparation-bank">open bank</a> · ' + pool.length + ' left</div>' +
        '<div class="qtext">' + esc(m.q) + '</div><div class="qopts">' +
        m.o.map(function (o, i) { return '<button data-i="' + i + '">(' + L[i] + ") " + esc(o) + "</button>"; }).join("") +
        '</div><div class="qfoot"><span class="qexp"></span><button class="btn" id="nextQ" hidden>Next question</button></div></div>';
      var bs = quiz.querySelectorAll(".qopts button");
      bs.forEach(function (b) {
        b.onclick = function () {
          var i = +b.dataset.i; done++; if (i === m.c) right++; score();
          bs.forEach(function (x) { x.disabled = true; });
          bs[m.c].classList.add("right"); if (i !== m.c) b.classList.add("wrong");
          quiz.querySelector(".qexp").textContent = (i === m.c ? "Correct. " : "Answer: (" + L[m.c] + "). ") + (m.e || "");
          var n = document.getElementById("nextQ"); n.hidden = false; n.onclick = next; n.focus();
        };
      });
    }
    fetch("assets/mcq.json").then(function (r) { return r.json(); }).then(function (d) {
      all = d; var p = new URLSearchParams(location.search).get("course"); if (p) sel.value = p; reset();
    });
    sel.addEventListener("change", reset);
  }
})();

/* ---------- Read aloud (Web Speech API) ---------- */
(function () {
  "use strict";
  var bar = document.getElementById("ttsBar");
  var btns = document.querySelectorAll(".tts-btn");
  if (!bar || !btns.length) return;
  var live = document.getElementById("ttsLive");
  function say(msg) { if (live) { live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 50); } }
  if (!("speechSynthesis" in window)) {
    btns.forEach(function (b) { b.disabled = true; b.title = "Read aloud is not supported in this browser"; });
    return;
  }
  var synth = window.speechSynthesis;
  var nowEl = document.getElementById("ttsNow"), playBtn = document.getElementById("ttsPlay");
  var rateSel = document.getElementById("ttsRate"), voiceSel = document.getElementById("ttsVoice");
  var queue = [], idx = 0, label = "", playing = false, paused = false, current = null, token = 0;
  try { var r = localStorage.getItem("ttsRate"); if (r) rateSel.value = r; } catch (e) {}

  // Voices
  var voices = [];
  function loadVoices() {
    voices = synth.getVoices().filter(function (v) { return /^(en|bn)/i.test(v.lang); });
    if (!voices.length) voices = synth.getVoices();
    var saved = ""; try { saved = localStorage.getItem("ttsVoice") || ""; } catch (e) {}
    voiceSel.innerHTML = '<option value="">Default</option>' + voices.map(function (v, i) {
      return '<option value="' + i + '"' + (v.name === saved ? " selected" : "") + ">" + v.name.replace(/</g, "") + " (" + v.lang + ")</option>";
    }).join("");
  }
  loadVoices();
  if (typeof synth.onvoiceschanged !== "undefined") synth.onvoiceschanged = loadVoices;
  function pickVoice(isBangla) {
    if (isBangla) { for (var i = 0; i < voices.length; i++) if (/^bn/i.test(voices[i].lang)) return voices[i]; return null; }
    var v = voiceSel.value; return v === "" ? null : voices[+v];
  }

  // Collect readable blocks inside a container or a range
  var SEL = "h1,h2,h3,h4,p,li,th,td,figcaption,.box-label,.cur-label,.cur-unit,.cur-h,.cur-sub,img[alt]";
  function readable(el) {
    if (el.closest(".unit-tools,.tts-bar,details.answer,.done-btn,script,style")) return false;
    var d = el.closest("details");
    if (d && !d.open && !el.matches("summary") && !d.classList.contains("unit-summary") && !d.classList.contains("curriculum")) return false;
    if (el.matches("p,li,td,th") && el.querySelector("p,li,ul,ol,table")) return false;
    return true;
  }
  function textFor(el) {
    if (el.tagName === "IMG") { var a = el.getAttribute("alt") || ""; return a && a !== "Diagram" ? "Figure: " + a : ""; }
    var t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (/^H[1-4]$/.test(el.tagName)) t = t.replace(/\.$/, "") + ".";
    if (el.matches(".box-label,.cur-label,.cur-h")) t = t.charAt(0) + t.slice(1).toLowerCase() + ":";
    if (el.tagName === "LI" && el.parentElement && el.parentElement.tagName === "OL") {
      var n = Array.prototype.indexOf.call(el.parentElement.children, el) + 1; t = n + ". " + t;
    }
    return t;
  }
  function chunk(t) {
    if (t.length <= 220) return [t];
    var parts = t.match(/[^.!?।]+[.!?।]+["”’)]*\s*|[^.!?।]+$/g) || [t], out = [], buf = "";
    parts.forEach(function (p) { if ((buf + p).length > 220 && buf) { out.push(buf.trim()); buf = p; } else buf += p; });
    if (buf.trim()) out.push(buf.trim());
    return out;
  }
  function collect(nodes) {
    var q = [];
    nodes.forEach(function (root) {
      var list = root.matches && root.matches(SEL) ? [root] : [];
      list = list.concat(Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll(SEL) : []));
      list.forEach(function (el) {
        if (!readable(el)) return;
        var t = textFor(el); if (!t) return;
        chunk(t).forEach(function (c) { q.push({ el: el, text: c }); });
      });
    });
    return q;
  }
  function chapterNodes(h1) {
    var nodes = [h1], n = h1.nextElementSibling;
    while (n && n.tagName !== "H1") {
      if (!n.classList.contains("unit-tools") && !n.classList.contains("unit-summary")) nodes.push(n);
      n = n.nextElementSibling;
    }
    return nodes;
  }

  // Playback
  function clearMark() { document.querySelectorAll(".tts-reading").forEach(function (e) { e.classList.remove("tts-reading"); }); }
  function speakAt(i) {
    token++; var my = token;
    synth.cancel();
    if (i < 0) i = 0;
    if (i >= queue.length) { finish(true); return; }
    idx = i; var item = queue[i];
    clearMark(); item.el.classList.add("tts-reading");
    var rect = item.el.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > window.innerHeight - 120) item.el.scrollIntoView({ block: "center", behavior: "smooth" });
    nowEl.textContent = label + " · part " + (i + 1) + " of " + queue.length;
    var u = new SpeechSynthesisUtterance(item.text);
    var bn = /[ঀ-৿]/.test(item.text);
    u.lang = bn ? "bn-BD" : (document.documentElement.lang || "en");
    var v = pickVoice(bn); if (v) u.voice = v;
    u.rate = parseFloat(rateSel.value) || 1;
    u.onend = function () { if (my === token && playing && !paused) speakAt(idx + 1); };
    u.onerror = function (e) { if (my === token && e.error !== "interrupted" && e.error !== "canceled") speakAt(idx + 1); };
    current = u; synth.speak(u);
  }
  function start(q, name) {
    if (!q.length) { say("Nothing to read here."); return; }
    queue = q; label = name; playing = true; paused = false;
    bar.hidden = false; document.body.classList.add("tts-on");
    setPlayIcon(); say("Reading " + name + ". Use the player at the bottom of the page to pause, skip or stop.");
    setTimeout(function () { speakAt(0); }, 350);
  }
  function finish(done) {
    token++; synth.cancel(); playing = false; paused = false; clearMark();
    bar.hidden = true; document.body.classList.remove("tts-on");
    say(done ? "Finished reading " + label + "." : "Reading stopped.");
  }
  function setPlayIcon() {
    playBtn.textContent = paused ? "▶" : "⏸";
    playBtn.setAttribute("aria-label", paused ? "Resume reading" : "Pause reading");
  }
  function togglePause() {
    if (!playing) return;
    if (paused) { paused = false; speakAt(idx); say("Resumed."); }
    else { paused = true; token++; synth.cancel(); say("Paused."); }
    setPlayIcon();
  }
  // Chrome stops long speech after ~15s without this nudge
  setInterval(function () { if (playing && !paused && synth.speaking) { synth.pause(); synth.resume(); } }, 10000);

  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      var kind = b.dataset.tts, q = [], name = "";
      if (kind === "all") {
        var course = document.querySelector(".course");
        q = collect([course.querySelector(".course-title"), course.querySelector(".subtitle")].filter(Boolean)
          .concat(Array.prototype.slice.call(document.querySelectorAll(".prose > *")).filter(function (n) { return !n.matches(".unit-tools,.unit-summary"); })));
        name = "all notes";
      } else if (kind === "unit") {
        var h = document.getElementById(b.dataset.target);
        q = collect(chapterNodes(h)); name = (h.textContent || "").trim();
      } else if (kind === "summary") {
        var d = document.getElementById(b.dataset.target); d.open = true;
        var h2 = d.parentElement && d.previousElementSibling;
        var title = (document.getElementById(b.dataset.target.replace(/^sum-/, "")) || {}).textContent || "";
        q = [{ el: d, text: "Summary of " + title.trim() + "." }].concat(collect([d.querySelector(".sum-body")]));
        name = "summary of " + title.trim();
      }
      start(q, name);
    });
  });
  playBtn.addEventListener("click", togglePause);
  document.getElementById("ttsStop").addEventListener("click", function () { finish(false); });
  document.getElementById("ttsNext").addEventListener("click", function () { if (playing) { paused = false; setPlayIcon(); speakAt(idx + 1); } });
  document.getElementById("ttsPrev").addEventListener("click", function () { if (playing) { paused = false; setPlayIcon(); speakAt(idx - 1); } });
  rateSel.addEventListener("change", function () { try { localStorage.setItem("ttsRate", rateSel.value); } catch (e) {} if (playing && !paused) speakAt(idx); });
  voiceSel.addEventListener("change", function () { try { localStorage.setItem("ttsVoice", voiceSel.value === "" ? "" : voices[+voiceSel.value].name); } catch (e) {} if (playing && !paused) speakAt(idx); });
  // Keyboard: Alt+Shift+P pause/resume, Alt+Shift+S stop, Alt+Shift+N / B next / back
  document.addEventListener("keydown", function (e) {
    if (!e.altKey || !e.shiftKey) return;
    var k = e.key.toLowerCase();
    if (k === "p") { e.preventDefault(); togglePause(); }
    else if (k === "s") { e.preventDefault(); if (playing) finish(false); }
    else if (k === "n") { e.preventDefault(); if (playing) speakAt(idx + 1); }
    else if (k === "b") { e.preventDefault(); if (playing) speakAt(idx - 1); }
  });
  window.addEventListener("beforeunload", function () { synth.cancel(); });
})();
