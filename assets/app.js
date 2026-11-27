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
