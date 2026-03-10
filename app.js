(() => {
  'use strict';

  const D = window.DO_ROLE_DATA;
  const STORAGE_KEY = 'do-role-evolution-edits';
  const VERSIONS_KEY = 'do-role-evolution-versions';

  /* ═══════════════════════════════════════════════
     Utilities
     ═══════════════════════════════════════════════ */

  function combinations(items, size) {
    const out = [];
    (function walk(start, buf) {
      if (buf.length === size) { out.push([...buf]); return; }
      for (let i = start; i < items.length; i++) {
        buf.push(items[i]); walk(i + 1, buf); buf.pop();
      }
    })(0, []);
    return out;
  }

  function uniq(arr) { return [...new Set(arr)]; }
  function nodeId(prefix, lenses) { return `${prefix}:${[...lenses].sort().join('+')}`; }

  function phaseCoverageFor(lenses) {
    return D.PHASE_RULES
      .filter(p => lenses.includes(p.requiredLens) && p.additionalLenses.some(l => lenses.includes(l)))
      .map(p => p.id);
  }

  /* ═══════════════════════════════════════════════
     Persistence (localStorage)
     ═══════════════════════════════════════════════ */

  // ── Pending edits ──
  function loadEdits() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveEdits(e) { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); }

  function getOverride(nid, field) {
    const e = loadEdits()[nid];
    return e ? e[field] : undefined;
  }
  function setOverride(nid, field, value) {
    const e = loadEdits();
    if (!e[nid]) e[nid] = {};
    e[nid][field] = value;
    saveEdits(e);
  }
  function clearOverrides(nid) {
    const e = loadEdits();
    delete e[nid];
    saveEdits(e);
  }
  function clearAllOverrides() { localStorage.removeItem(STORAGE_KEY); }
  function hasOverrides(nid) {
    const e = loadEdits()[nid];
    return Boolean(e && Object.keys(e).length);
  }

  // ── Version history ──
  function loadVersions() {
    try { return JSON.parse(localStorage.getItem(VERSIONS_KEY)) || []; }
    catch { return []; }
  }
  function saveVersions(v) { localStorage.setItem(VERSIONS_KEY, JSON.stringify(v)); }

  function latestVersion() {
    const vs = loadVersions();
    return vs.length ? vs[vs.length - 1] : null;
  }

  function getBaselineValue(nid, field) {
    const lv = latestVersion();
    if (!lv) return undefined;
    const snap = lv.snapshot[nid];
    return snap ? snap[field] : undefined;
  }

  /** Baseline value: latest version snapshot, falling back to node default. */
  function baselineEff(node, field) {
    const b = getBaselineValue(node.id, field);
    if (b !== undefined) return b;
    return field === 'bullets' ? node.bullets : node[field];
  }

  /** Effective value: pending edit → latest version → node default. */
  function eff(node, field) {
    const o = getOverride(node.id, field);
    if (o !== undefined) return o;
    return baselineEff(node, field);
  }

  /* ═══════════════════════════════════════════════
     Diff engine
     ═══════════════════════════════════════════════ */

  function diffField(node, field) {
    const override = getOverride(node.id, field);
    if (override === undefined) return null;
    const base = baselineEff(node, field);
    if (override === base) return null;
    return { type: 'modified', oldVal: base, newVal: override };
  }

  function lcsArrayDiff(oldArr, newArr) {
    const m = oldArr.length, n = newArr.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = oldArr[i - 1] === newArr[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);

    const ops = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldArr[i - 1] === newArr[j - 1]) {
        ops.unshift({ type: 'keep', text: oldArr[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.unshift({ type: 'added', text: newArr[j - 1] });
        j--;
      } else {
        ops.unshift({ type: 'removed', text: oldArr[i - 1] });
        i--;
      }
    }
    return ops;
  }

  function diffBullets(node) {
    const override = getOverride(node.id, 'bullets');
    if (override === undefined) return null;
    const baseBullets = baselineEff(node, 'bullets');
    if (JSON.stringify(baseBullets) === JSON.stringify(override)) return null;
    const ops = lcsArrayDiff(baseBullets, override);
    return ops.length ? ops : null;
  }

  function diffNode(node) {
    const titleDiff = diffField(node, 'title');
    const summaryDiff = diffField(node, 'summary');
    const bulletsDiff = diffBullets(node);
    if (!titleDiff && !summaryDiff && !bulletsDiff) return null;
    return { nodeId: node.id, title: titleDiff, summary: summaryDiff, bullets: bulletsDiff };
  }

  function computeAllDiffs() {
    const diffs = [];
    for (const node of graph.allNodes) {
      const d = diffNode(node);
      if (d) diffs.push(d);
    }
    return diffs;
  }

  function hasPendingChanges() {
    return computeAllDiffs().length > 0;
  }

  /* ═══════════════════════════════════════════════
     Graph builder
     ═══════════════════════════════════════════════ */

  function buildGraph() {
    const nodesByLevel = { base: [], intermediate: [], senior: [], leadership: [] };
    const allNodes = [];

    // ── Base nodes (one per lens) ──
    for (const lens of D.BASE_LENSES) {
      const lc = D.LENS_CONTENT[lens];
      const pc = phaseCoverageFor([lens]);
      nodesByLevel.base.push({
        id: nodeId('base', [lens]),
        level: 'base',
        subtype: 'standard',
        title: `${lens} Lens`,
        lenses: [lens],
        phaseCoverage: pc,
        summary: `Direct implementation role building core ${lens} skills. ${lc.summary}`,
        bullets: [
          'Execute assigned modeling, drafting, and coordination tasks with clear guidance and review from supervisor.',
          'Build technical quality habits and dependable delivery fundamentals \u2014 take the time to do it right the first time.',
          ...lc.bullets.slice(0, 5)
        ],
        source: [lens]
      });
    }

    // ── Intermediate nodes (one per phase) ──
    for (const phase of D.PHASE_RULES) {
      const qualCombos = combinations(D.BASE_LENSES, 2).filter(c =>
        c.includes(phase.requiredLens) && c.some(l => phase.additionalLenses.includes(l))
      );
      const allLeadLenses = uniq(qualCombos.flat());
      const displayLenses = [phase.requiredLens, ...phase.additionalLenses];
      const pc = D.PHASE_CONTENT[phase.id];

      const lensBullets = [];
      for (const lens of displayLenses) {
        const lb = D.LENS_CONTENT[lens]?.bullets || [];
        lensBullets.push(...lb.slice(0, 2));
      }

      nodesByLevel.intermediate.push({
        id: `intermediate:${phase.id}`,
        level: 'intermediate',
        subtype: 'phaseIntermediate',
        phaseId: phase.id,
        qualificationCombos: qualCombos,
        title: `${phase.id} Phase Integrator`,
        lenses: allLeadLenses,
        requiredLenses: [phase.requiredLens],
        additionalLenses: [...phase.additionalLenses],
        displayLenses,
        phaseCoverage: [phase.id],
        summary: `${phase.label} integrator: ${pc.summary}`,
        bullets: [
          `Required Lens = ${phase.requiredLens}; Additional Lens (pick 1) = ${phase.additionalLenses.join(' or ')}.`,
          ...pc.bullets,
          'Guide contributors with clear direction, review standards, and timely feedback.',
          ...uniq(lensBullets).slice(0, 4)
        ],
        source: uniq(['DO', ...displayLenses])
      });
    }

    // ── Senior nodes (phase bridges) ──
    for (const bridge of D.PHASE_BRIDGES) {
      const rule = D.BRIDGE_LENS_RULES[bridge.id] || { requiredLenses: [], requiredOneOf: [] };
      const autoAdditional = D.BASE_LENSES.filter(l => !rule.requiredLenses.includes(l));
      const qualCombos = combinations(D.BASE_LENSES, 3).filter(c => {
        const hasReq = rule.requiredLenses.every(l => c.includes(l));
        const hasOneOf = !rule.requiredOneOf?.length || rule.requiredOneOf.some(l => c.includes(l));
        const hasAdd = !autoAdditional.length || autoAdditional.some(l => c.includes(l));
        return hasReq && hasOneOf && hasAdd;
      });
      const allLeadLenses = uniq(qualCombos.flat());
      const displayLenses = uniq([
        ...rule.requiredLenses,
        ...(rule.requiredOneOf || []),
        ...autoAdditional
      ]);
      const bc = D.BRIDGE_CONTENT[bridge.id];

      const reqText = rule.requiredLenses.join(' + ') +
        (rule.requiredOneOf?.length ? ` + (${rule.requiredOneOf.join(' or ')})` : '');
      const addText = autoAdditional.length ? autoAdditional.join(' or ') : 'none';

      const lensBullets = [];
      for (const lens of displayLenses) {
        const lb = D.LENS_CONTENT[lens]?.bullets || [];
        lensBullets.push(...lb.slice(0, 2));
      }

      nodesByLevel.senior.push({
        id: `seniorBridge:${bridge.id}`,
        level: 'senior',
        subtype: 'phaseBridgeSenior',
        bridgePhases: [bridge.from, bridge.to],
        qualificationCombos: qualCombos,
        title: `${bridge.label} Phase Crossover`,
        lenses: allLeadLenses,
        requiredLenses: rule.requiredLenses,
        requiredOneOf: rule.requiredOneOf || [],
        additionalLenses: autoAdditional,
        displayLenses,
        phaseCoverage: [bridge.from, bridge.to],
        summary: `${bridge.label} crossover: ${bc.summary}`,
        bullets: [
          `Required Lenses = ${reqText}; Additional Lens (1) = ${addText}.`,
          ...bc.bullets,
          'Operate across three lenses with ownership of scope integration decisions.',
          'Lead implementation while overseeing quality, sequencing, and cross-team coordination.',
          ...uniq(lensBullets).slice(0, 4)
        ],
        source: uniq(['DO', ...displayLenses])
      });
    }

    // ── Leadership: Project Lead ──
    const pl = D.PROJECT_LEAD_DEF;
    nodesByLevel.leadership.push({
      id: 'leadership:projectLead',
      level: 'leadership',
      subtype: 'projectLead',
      title: pl.title,
      lenses: [...D.BASE_LENSES],
      displayLenses: [...D.BASE_LENSES],
      phaseCoverage: ['BD', 'EOR', 'Delivery'],
      summary: pl.summary,
      bullets: [...pl.bullets],
      source: ['DO']
    });

    // ── Leadership: Process Managers ──
    for (const mgr of D.MANAGER_DEFS) {
      const lenses = uniq([...mgr.displayLenses, 'CoDe']);
      nodesByLevel.leadership.push({
        id: `leadership:manager:${mgr.id}`,
        level: 'leadership',
        subtype: 'manager',
        managerLens: mgr.managerLens,
        title: mgr.title,
        lenses,
        displayLenses: mgr.displayLenses,
        phaseCoverage: ['BD', 'EOR', 'Delivery'],
        summary: mgr.summary,
        bullets: [...mgr.bullets],
        source: uniq(['DO', ...mgr.displayLenses])
      });
    }

    // Collect all
    for (const lvl of D.LEVELS) allNodes.push(...nodesByLevel[lvl.key]);
    const nodeById = new Map(allNodes.map(n => [n.id, n]));

    // ── Edges ──
    const edges = [];

    connect('base', 'intermediate', (a, b) => {
      if (b.subtype !== 'phaseIntermediate') return false;
      return (b.displayLenses || []).includes(a.lenses[0]);
    });

    connect('intermediate', 'senior', (a, b) => {
      if (a.subtype === 'phaseIntermediate') return b.phaseCoverage.includes(a.phaseId);
      return a.lenses.every(x => b.lenses.includes(x));
    });

    connect('senior', 'leadership', (a, b) => {
      if (a.subtype === 'phaseBridgeSenior') return seniorToLeadershipEligible(a, b);
      if (b.subtype === 'projectLead') return a.phaseCoverage.length === 3 && a.lenses.includes('CoDe');
      if (b.subtype === 'manager') return a.lenses.includes(b.managerLens) && a.lenses.includes('CoDe') && a.phaseCoverage.length >= 2;
      return false;
    });

    function connect(fromKey, toKey, rule) {
      for (const f of nodesByLevel[fromKey]) {
        for (const t of nodesByLevel[toKey]) {
          if (rule(f, t)) edges.push({ from: f.id, to: t.id });
        }
      }
    }

    return { nodesByLevel, allNodes, nodeById, edges };
  }

  function seniorToLeadershipEligible(sn, ln) {
    if (!sn || !ln) return false;
    if (sn.subtype !== 'phaseBridgeSenior') return false;
    if (ln.level !== 'leadership') return false;
    if (ln.subtype === 'projectLead') return true;
    if (ln.subtype !== 'manager') return false;
    if (ln.managerLens === 'Delivery') return sn.bridgePhases.includes('Delivery');
    if (ln.managerLens === 'DLT')      return sn.bridgePhases.includes('Delivery');
    if (ln.managerLens === 'BIM')      return sn.bridgePhases.includes('BD') || sn.bridgePhases.includes('EOR');
    if (ln.managerLens === 'CoDe')     return true;
    return false;
  }

  /* ═══════════════════════════════════════════════
     SYNC & Version management
     ═══════════════════════════════════════════════ */

  function syncAll() {
    const diffs = computeAllDiffs();
    if (!diffs.length) return;

    const count = diffs.length;
    if (!confirm(`Accept ${count} pending change(s) as a new version?\n\nThis creates a versioned snapshot of all current edits.`)) return;

    // Build snapshot of effective state (only fields that differ from data.js defaults)
    const snapshot = {};
    for (const node of graph.allNodes) {
      const effTitle = eff(node, 'title');
      const effSummary = eff(node, 'summary');
      const effBullets = eff(node, 'bullets');

      const entry = {};
      if (effTitle !== node.title) entry.title = effTitle;
      if (effSummary !== node.summary) entry.summary = effSummary;
      if (JSON.stringify(effBullets) !== JSON.stringify(node.bullets)) entry.bullets = [...effBullets];

      if (Object.keys(entry).length) snapshot[node.id] = entry;
    }

    const versions = loadVersions();
    const nextId = versions.length ? versions[versions.length - 1].id + 1 : 1;
    versions.push({
      id: nextId,
      timestamp: new Date().toISOString(),
      label: `Version ${nextId}`,
      snapshot
    });

    saveVersions(versions);
    clearAllOverrides();
    renderCards();
    applyFiltersAndHighlight();
    renderEdges();
    updateSyncState();
  }

  function restoreVersion(versionId) {
    const versions = loadVersions();
    const target = versions.find(v => v.id === versionId);
    if (!target) return;

    if (!confirm(`Restore "${target.label}"?\n\nThis will create a new version matching that snapshot. Current pending edits will be discarded.`)) return;

    // Create a new version that copies the target's snapshot
    const nextId = versions[versions.length - 1].id + 1;
    versions.push({
      id: nextId,
      timestamp: new Date().toISOString(),
      label: `Version ${nextId} (restored from ${target.label})`,
      snapshot: JSON.parse(JSON.stringify(target.snapshot))
    });

    saveVersions(versions);
    clearAllOverrides();
    renderCards();
    applyFiltersAndHighlight();
    renderEdges();
    updateSyncState();
  }

  function updateSyncState() {
    const pending = hasPendingChanges();
    const syncBtn = document.getElementById('syncBtn');
    const countEl = document.getElementById('changeCount');
    const diffs = computeAllDiffs();

    syncBtn.disabled = !pending;
    syncBtn.classList.toggle('has-changes', pending);
    countEl.textContent = diffs.length ? `(${diffs.length})` : '';

    if (state.changeLogOpen) renderChangeLog();
  }

  /* ═══════════════════════════════════════════════
     DOM references & state
     ═══════════════════════════════════════════════ */

  const ui = {
    host:     document.getElementById('graphHost'),
    levels:   document.getElementById('levels'),
    links:    document.getElementById('linksLayer'),
    lens:     document.getElementById('focusLens'),
    phase:    document.getElementById('focusPhase'),
    showAll:  document.getElementById('showAllLinks'),
    resetBtn: document.getElementById('resetAll')
  };

  const state = { selectedId: null, focusLens: 'all', focusPhase: 'all', showDiffs: false, changeLogOpen: false };

  /* ═══════════════════════════════════════════════
     Rendering
     ═══════════════════════════════════════════════ */

  function nodeLensSet(n) { return n.displayLenses || n.lenses || []; }

  function renderSkeleton() {
    // lens dropdown
    ui.lens.innerHTML = ['all', ...D.BASE_LENSES]
      .map(l => `<option value="${l}">${l === 'all' ? 'All lenses' : l}</option>`)
      .join('');

    // level rows
    ui.levels.innerHTML = D.LEVELS.map(l => `
      <div class="level-col" data-level="${l.key}">
        <h2>${l.title}</h2>
        <div class="nodes" id="nodes-${l.key}"></div>
      </div>
    `).join('');
  }

  function cardHtml(node) {
    const title   = eff(node, 'title');
    const summary = eff(node, 'summary');
    const bullets = eff(node, 'bullets');
    const dl = node.displayLenses || node.lenses;
    const edited = hasOverrides(node.id);
    const diff = state.showDiffs ? diffNode(node) : null;

    const phaseHtml = node.phaseCoverage?.length
      ? `<div class="phase-row"><span class="badge-label">Phases:</span>${node.phaseCoverage.map(p => `<span class="phase-tag">${p}</span>`).join('')}</div>`
      : '';

    const reqHtml = node.requiredLenses?.length
      ? `<div class="meta-row"><span class="badge-label">Required:</span>${node.requiredLenses.map(l => `<span class="lens-tag">${l}</span>`).join('')}${(node.requiredOneOf?.length) ? `<span class="lens-tag">(${node.requiredOneOf.join(' or ')})</span>` : ''}</div>`
      : '';

    const addHtml = node.additionalLenses?.length
      ? `<div class="meta-row"><span class="badge-label">Additional (1):</span>${node.additionalLenses.map(l => `<span class="lens-tag">${l}</span>`).join('')}</div>`
      : `<div class="meta-row"><span class="badge-label">Lenses:</span>${dl.map(l => `<span class="lens-tag">${l}</span>`).join('')}</div>`;

    // ── Title rendering ──
    let titleInner;
    if (diff && diff.title) {
      titleInner = `<del class="diff-old">${escHtml(diff.title.oldVal)}</del> <ins class="diff-new">${escHtml(diff.title.newVal)}</ins>`;
    } else {
      titleInner = escHtml(title);
    }

    // ── Summary rendering ──
    let summaryInner;
    if (diff && diff.summary) {
      summaryInner = `<del class="diff-old">${escHtml(diff.summary.oldVal)}</del><ins class="diff-new">${escHtml(diff.summary.newVal)}</ins>`;
    } else {
      summaryInner = escHtml(summary);
    }

    // ── Bullets rendering ──
    let bulletListHtml;
    if (diff && diff.bullets) {
      let pendIdx = 0;
      bulletListHtml = diff.bullets.map(op => {
        if (op.type === 'removed') {
          return `<li class="diff-removed"><span>${escHtml(op.text)}</span></li>`;
        }
        const idx = pendIdx++;
        if (op.type === 'added') {
          return `<li class="diff-added">
            <span class="bullet-text" data-editable data-field="bullet" data-index="${idx}">${escHtml(op.text)}</span>
            <button class="btn-remove-bullet" title="Remove this item">&times;</button>
          </li>`;
        }
        // keep
        return `<li>
          <span class="bullet-text" data-editable data-field="bullet" data-index="${idx}">${escHtml(op.text)}</span>
          <button class="btn-remove-bullet" title="Remove this item">&times;</button>
        </li>`;
      }).join('');
    } else {
      bulletListHtml = bullets.map((b, i) => `
        <li>
          <span class="bullet-text" data-editable data-field="bullet" data-index="${i}">${escHtml(b)}</span>
          <button class="btn-remove-bullet" title="Remove this item">&times;</button>
        </li>
      `).join('');
    }

    const hasDiffs = diff !== null;

    return `
      <article class="role-card${hasDiffs ? ' has-diffs' : ''}" data-node-id="${node.id}">
        <div class="card-head">
          <h3 data-editable data-field="title">${titleInner}</h3>
          ${edited ? '<span class="edit-dot" title="Has pending edits"></span>' : ''}
        </div>
        ${reqHtml}${addHtml}${phaseHtml}
        <div class="summary" data-editable data-field="summary">${summaryInner}</div>
        <div class="detail">
          <strong>Responsibilities</strong>
          <ul class="bullet-list">${bulletListHtml}</ul>
          <button class="btn-add-bullet" title="Add a responsibility">+ Add</button>
          ${edited ? '<button class="btn-card-reset" title="Reset this card to defaults">Reset card</button>' : ''}
        </div>
      </article>
    `;
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderCards() {
    for (const lvl of D.LEVELS) {
      document.getElementById(`nodes-${lvl.key}`).innerHTML =
        graph.nodesByLevel[lvl.key].map(cardHtml).join('');
    }
  }

  function rerenderCard(nid) {
    const old = ui.levels.querySelector(`[data-node-id="${nid}"]`);
    if (!old) return;
    const wasExpanded = old.classList.contains('expanded');
    const wasMuted = old.classList.contains('muted');
    const node = graph.nodeById.get(nid);
    old.outerHTML = cardHtml(node);
    const fresh = ui.levels.querySelector(`[data-node-id="${nid}"]`);
    if (wasExpanded) fresh.classList.add('expanded');
    if (wasMuted) fresh.classList.add('muted');
  }

  /* ═══════════════════════════════════════════════
     Change log panel
     ═══════════════════════════════════════════════ */

  function renderChangeLog() {
    const body = document.getElementById('changeLogBody');
    const tab = state.changeLogTab || 'pending';

    // Tab buttons
    const tabHtml = `
      <div class="cl-tabs">
        <button class="cl-tab${tab === 'pending' ? ' active' : ''}" data-cl-tab="pending">Pending Changes</button>
        <button class="cl-tab${tab === 'history' ? ' active' : ''}" data-cl-tab="history">Version History</button>
      </div>
    `;

    if (tab === 'pending') {
      const diffs = computeAllDiffs();
      if (!diffs.length) {
        body.innerHTML = tabHtml + '<p class="changelog-empty">No pending changes.</p>';
        return;
      }

      body.innerHTML = tabHtml + diffs.map(d => {
        const node = graph.nodeById.get(d.nodeId);
        const sections = [];

        if (d.title) {
          sections.push(`<div class="cl-field">
            <span class="cl-label">Title</span>
            <del>${escHtml(d.title.oldVal)}</del>
            <ins>${escHtml(d.title.newVal)}</ins>
          </div>`);
        }

        if (d.summary) {
          sections.push(`<div class="cl-field">
            <span class="cl-label">Summary</span>
            <del>${escHtml(d.summary.oldVal)}</del>
            <ins>${escHtml(d.summary.newVal)}</ins>
          </div>`);
        }

        if (d.bullets) {
          const changed = d.bullets.filter(op => op.type !== 'keep');
          if (changed.length) {
            const bulletsHtml = changed.map(op => {
              if (op.type === 'added') return `<li class="cl-added">+ ${escHtml(op.text)}</li>`;
              if (op.type === 'removed') return `<li class="cl-removed">\u2212 ${escHtml(op.text)}</li>`;
              return '';
            }).join('');
            sections.push(`<div class="cl-field">
              <span class="cl-label">Responsibilities</span>
              <ul class="cl-bullets">${bulletsHtml}</ul>
            </div>`);
          }
        }

        return `<div class="cl-card">
          <h3>${escHtml(eff(node, 'title'))}</h3>
          <span class="cl-node-id">${d.nodeId}</span>
          ${sections.join('')}
        </div>`;
      }).join('');

    } else {
      // Version history
      const versions = loadVersions();
      if (!versions.length) {
        body.innerHTML = tabHtml + '<p class="changelog-empty">No versions yet. Use Sync to create one.</p>';
        return;
      }

      body.innerHTML = tabHtml + versions.slice().reverse().map(v => {
        const changedCount = Object.keys(v.snapshot).length;
        const ts = new Date(v.timestamp);
        const dateStr = ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const isLatest = v.id === versions[versions.length - 1].id;

        return `<div class="version-item${isLatest ? ' is-latest' : ''}" data-version-id="${v.id}">
          <div class="version-header">
            <strong class="version-label">${escHtml(v.label)}</strong>
            ${isLatest ? '<span class="version-badge">Current</span>' : ''}
          </div>
          <div class="version-meta">${dateStr} at ${timeStr} &middot; ${changedCount} card(s) modified</div>
          ${!isLatest ? `<button class="btn-restore" data-restore-id="${v.id}">Restore this version</button>` : ''}
        </div>`;
      }).join('');
    }
  }

  function toggleChangeLog() {
    state.changeLogOpen = !state.changeLogOpen;
    const panel = document.getElementById('changeLog');
    panel.classList.toggle('open', state.changeLogOpen);
    if (state.changeLogOpen) renderChangeLog();
  }

  /* ═══════════════════════════════════════════════
     Edge rendering (SVG)
     ═══════════════════════════════════════════════ */

  function renderEdges() {
    ui.links.innerHTML = graph.edges.map(e =>
      `<path class="edge" data-edge-from="${e.from}" data-edge-to="${e.to}" />`
    ).join('');
    layoutEdges();
  }

  function layoutEdges() {
    const cw = Math.max(ui.host.clientWidth, ui.host.scrollWidth);
    const ch = Math.max(ui.host.clientHeight, ui.host.scrollHeight);
    ui.links.style.width = cw + 'px';
    ui.links.style.height = ch + 'px';
    ui.links.setAttribute('width', cw);
    ui.links.setAttribute('height', ch);
    ui.links.setAttribute('viewBox', `0 0 ${cw} ${ch}`);

    const hb = ui.host.getBoundingClientRect();
    const cards = new Map(
      [...ui.levels.querySelectorAll('.role-card')].map(el => [el.dataset.nodeId, el.getBoundingClientRect()])
    );

    for (const path of ui.links.querySelectorAll('.edge')) {
      const f = cards.get(path.dataset.edgeFrom);
      const t = cards.get(path.dataset.edgeTo);
      if (!f || !t) continue;
      const x1 = f.left + f.width / 2 - hb.left + ui.host.scrollLeft;
      const y1 = f.bottom - hb.top + ui.host.scrollTop;
      const x2 = t.left + t.width / 2 - hb.left + ui.host.scrollLeft;
      const y2 = t.top - hb.top + ui.host.scrollTop;
      const dy = Math.max(32, (y2 - y1) * 0.45);
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`);
    }
  }

  /* ═══════════════════════════════════════════════
     Filtering & highlighting
     ═══════════════════════════════════════════════ */

  function getAdjacent(nid) {
    const parents = new Set(), children = new Set();
    for (const e of graph.edges) {
      if (e.from === nid) children.add(e.to);
      if (e.to === nid) parents.add(e.from);
    }
    return { parents, children };
  }

  function edgeAlignsWithRequired(fromNode, toNode) {
    if (!fromNode || !toNode) return false;
    if (!toNode.requiredLenses?.length) return false;
    const fl = nodeLensSet(fromNode);
    return toNode.requiredLenses.some(l => fl.includes(l));
  }

  function applyFiltersAndHighlight() {
    const cards = [...ui.levels.querySelectorAll('.role-card')];
    const sel = state.selectedId ? graph.nodeById.get(state.selectedId) : null;
    const hood = new Set();

    if (sel) {
      hood.add(sel.id);
      const { parents, children } = getAdjacent(sel.id);
      parents.forEach(x => hood.add(x));
      children.forEach(x => hood.add(x));
      for (const n of graph.allNodes) {
        if (sel.level === 'senior' && n.level === 'leadership' && seniorToLeadershipEligible(sel, n))
          hood.add(n.id);
      }
    }

    cards.forEach(card => {
      const n = graph.nodeById.get(card.dataset.nodeId);
      const mL = state.focusLens === 'all' || nodeLensSet(n).includes(state.focusLens);
      const mP = state.focusPhase === 'all' || (n.phaseCoverage || []).includes(state.focusPhase);
      const mS = !sel || hood.has(n.id);
      card.classList.toggle('muted', !(mL && mP && mS));
      card.classList.toggle('expanded', state.selectedId === n.id);
    });

    const active = new Set();
    if (sel) {
      active.add(sel.id);
      const { parents, children } = getAdjacent(sel.id);
      parents.forEach(x => active.add(x));
      children.forEach(x => active.add(x));
    }

    for (const path of ui.links.querySelectorAll('.edge')) {
      const fid = path.dataset.edgeFrom, tid = path.dataset.edgeTo;
      const fn = graph.nodeById.get(fid), tn = graph.nodeById.get(tid);
      const mL = state.focusLens === 'all' || nodeLensSet(fn).includes(state.focusLens) || nodeLensSet(tn).includes(state.focusLens);
      const mP = state.focusPhase === 'all' || (fn.phaseCoverage || []).includes(state.focusPhase) || (tn.phaseCoverage || []).includes(state.focusPhase);

      let isActive = sel && active.has(fid) && active.has(tid);
      const isSeniorToLead = sel && sel.level === 'senior' && fid === sel.id && seniorToLeadershipEligible(sel, tn);
      if (isSeniorToLead) isActive = true;

      const reqAligned = sel && sel.requiredLenses?.length && tid === sel.id && edgeAlignsWithRequired(fn, sel);

      if (isActive) {
        path.style.display = '';
      } else if (!ui.showAll.checked) {
        path.style.display = 'none';
      } else {
        path.style.display = mL && mP ? '' : 'none';
      }
      path.classList.toggle('active', !!isActive);
      path.classList.toggle('required-active', !!reqAligned);
    }
  }

  /* ═══════════════════════════════════════════════
     Inline editing
     ═══════════════════════════════════════════════ */

  function startEditing(el, evt) {
    if (el.contentEditable === 'true') return;
    el.contentEditable = 'true';

    // Place cursor at click position
    if (evt && document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(evt.clientX, evt.clientY);
      if (range) {
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(range);
        return;
      }
    }
    el.focus();
  }

  function handleBlur(el) {
    if (el.contentEditable !== 'true') return;
    el.contentEditable = 'false';

    const card = el.closest('.role-card');
    if (!card) return;
    const nid = card.dataset.nodeId;
    const field = el.dataset.field;

    if (field === 'title' || field === 'summary') {
      setOverride(nid, field, el.textContent.trim());
    } else if (field === 'bullet') {
      saveBulletsFromCard(card, nid);
    }

    rerenderCard(nid);
    setTimeout(layoutEdges, 0);
    updateSyncState();
  }

  function saveBulletsFromCard(card, nid) {
    const bullets = [...card.querySelectorAll('[data-field="bullet"]')]
      .map(el => el.textContent.trim())
      .filter(Boolean);
    setOverride(nid, 'bullets', bullets);
  }

  function addBullet(card) {
    const nid = card.dataset.nodeId;
    const node = graph.nodeById.get(nid);
    const current = [...eff(node, 'bullets')];
    current.push('New responsibility\u2026');
    setOverride(nid, 'bullets', current);
    rerenderCard(nid);
    // Expand the card and focus the new bullet
    const fresh = ui.levels.querySelector(`[data-node-id="${nid}"]`);
    fresh.classList.add('expanded');
    const lastBullet = fresh.querySelector('[data-field="bullet"]:last-of-type') ||
                       [...fresh.querySelectorAll('[data-field="bullet"]')].pop();
    if (lastBullet) {
      startEditing(lastBullet);
      const range = document.createRange();
      range.selectNodeContents(lastBullet);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    setTimeout(layoutEdges, 0);
    updateSyncState();
  }

  function removeBullet(btn) {
    const card = btn.closest('.role-card');
    const nid = card.dataset.nodeId;
    const li = btn.closest('li');
    if (li) li.remove();
    saveBulletsFromCard(card, nid);
    rerenderCard(nid);
    // Keep expanded
    const fresh = ui.levels.querySelector(`[data-node-id="${nid}"]`);
    fresh.classList.add('expanded');
    setTimeout(layoutEdges, 0);
    updateSyncState();
  }

  function resetCard(nid) {
    clearOverrides(nid);
    const wasSelected = state.selectedId === nid;
    rerenderCard(nid);
    if (wasSelected) {
      const card = ui.levels.querySelector(`[data-node-id="${nid}"]`);
      if (card) card.classList.add('expanded');
    }
    setTimeout(layoutEdges, 0);
    updateSyncState();
  }

  function resetAll() {
    if (loadVersions().length > 0 || Object.keys(loadEdits()).length > 0) {
      if (!confirm('Reset everything to factory defaults?\n\nThis will discard all pending edits AND all version history.')) return;
    }
    clearAllOverrides();
    localStorage.removeItem(VERSIONS_KEY);
    renderCards();
    applyFiltersAndHighlight();
    renderEdges();
    updateSyncState();
  }

  /* ═══════════════════════════════════════════════
     Events
     ═══════════════════════════════════════════════ */

  function bindEvents() {
    // ── Click background to collapse ──
    ui.host.addEventListener('click', (e) => {
      if (!e.target.closest('.role-card') && !e.target.closest('.btn-add-bullet') && !e.target.closest('.btn-remove-bullet') && !e.target.closest('.btn-card-reset') && state.selectedId) {
        state.selectedId = null;
        applyFiltersAndHighlight();
        setTimeout(layoutEdges, 0);
      }
    });

    // ── Card interactions ──
    ui.levels.addEventListener('click', (e) => {
      // Add bullet
      if (e.target.closest('.btn-add-bullet')) {
        e.stopPropagation();
        addBullet(e.target.closest('.role-card'));
        return;
      }
      // Remove bullet
      if (e.target.closest('.btn-remove-bullet')) {
        e.stopPropagation();
        removeBullet(e.target.closest('.btn-remove-bullet'));
        return;
      }
      // Card reset
      if (e.target.closest('.btn-card-reset')) {
        e.stopPropagation();
        resetCard(e.target.closest('.role-card').dataset.nodeId);
        return;
      }

      const card = e.target.closest('.role-card');
      if (!card) return;

      const nid = card.dataset.nodeId;
      const editable = e.target.closest('[data-editable]');

      // Only enter edit mode if the card is already expanded
      if (editable && card.classList.contains('expanded')) {
        e.stopPropagation();
        startEditing(editable, e);
        return;
      }

      // Toggle expand / select
      state.selectedId = state.selectedId === nid ? null : nid;
      applyFiltersAndHighlight();
      setTimeout(layoutEdges, 0);
    });

    // ── Blur: save edits ──
    ui.levels.addEventListener('focusout', (e) => {
      const editable = e.target.closest('[data-editable]');
      if (editable) handleBlur(editable);
    });

    // ── Keyboard in editable ──
    ui.levels.addEventListener('keydown', (e) => {
      const el = e.target.closest('[data-editable]');
      if (!el || el.contentEditable !== 'true') return;

      if (e.key === 'Escape') {
        el.blur();
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (el.dataset.field === 'bullet') {
          const card = el.closest('.role-card');
          el.contentEditable = 'false';
          addBullet(card);
        } else {
          el.blur();
        }
      }
    });

    // ── Filter controls ──
    ui.lens.addEventListener('change', () => {
      state.focusLens = ui.lens.value;
      applyFiltersAndHighlight();
    });
    ui.phase.addEventListener('change', () => {
      state.focusPhase = ui.phase.value;
      applyFiltersAndHighlight();
    });
    ui.showAll.addEventListener('change', () => applyFiltersAndHighlight());

    // ── Show changes toggle ──
    document.getElementById('showDiffs').addEventListener('change', (e) => {
      state.showDiffs = e.target.checked;
      renderCards();
      applyFiltersAndHighlight();
      renderEdges();
    });

    // ── Sync ──
    document.getElementById('syncBtn').addEventListener('click', syncAll);

    // ── Change log ──
    document.getElementById('changeLogBtn').addEventListener('click', toggleChangeLog);
    document.getElementById('closeChangeLog').addEventListener('click', toggleChangeLog);

    // Change log tab & restore clicks (delegated)
    document.getElementById('changeLog').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-cl-tab]');
      if (tab) {
        state.changeLogTab = tab.dataset.clTab;
        renderChangeLog();
        return;
      }

      const restore = e.target.closest('[data-restore-id]');
      if (restore) {
        restoreVersion(Number(restore.dataset.restoreId));
        return;
      }
    });

    // ── Reset ──
    ui.resetBtn.addEventListener('click', resetAll);

    // ── Layout ──
    ui.host.addEventListener('scroll', layoutEdges, { passive: true });
    window.addEventListener('resize', layoutEdges);
  }

  /* ═══════════════════════════════════════════════
     Init
     ═══════════════════════════════════════════════ */

  const graph = buildGraph();
  renderSkeleton();
  renderCards();
  renderEdges();
  bindEvents();
  applyFiltersAndHighlight();
  updateSyncState();

})();
