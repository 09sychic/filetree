'use strict';

/**
 * UI Controller handles all DOM manipulations and event binding.
 */
const UI = {
  activeNodeId: null,
  focusNodeId: null,
  dragNodeId: null,
  previewTargetId: null,

  els: {
    nodesRoot: document.getElementById('nodes-root-list'),
    ascii: document.getElementById('ascii-render'),
    search: document.getElementById('node-search'),
    stats: { 
      nodes: document.getElementById('stat-nodes'), 
      depth: document.getElementById('stat-depth') 
    },
    breadcrumb: document.getElementById('breadcrumb-nav'),
    toast: document.getElementById('toast'),
    saveIndicator: document.getElementById('footer-save-indicator')
  },

  init() {
    this.setupEvents();
    this.setTheme(localStorage.getItem('neural_theme') || 'default');
    this.render();
  },

  render() {
    const draggingNode = this.dragNodeId ? app.findNode(this.dragNodeId) : null;
    this.renderSidebar();
    this.renderPreview(this.previewTargetId, draggingNode);
    this.renderBreadcrumbs();
    this.updateStats();
  },

  // ── SIDEBAR RENDERING ──
  renderSidebar() {
    this.els.nodesRoot.innerHTML = '';
    const searchTerm = this.els.search.value.toLowerCase();
    const nodes = this.focusNodeId ? [app.findNode(this.focusNodeId)] : app.data;
    
    const build = (nodes, container) => {
      nodes.forEach(node => {
        if (searchTerm && !this.matchesSearch(node, searchTerm)) return;
        
        const item = document.createElement('div');
        item.className = 'node-item';
        item.appendChild(this.createNodeRow(node));

        if (node.children.length > 0) {
          const childContainer = document.createElement('div');
          childContainer.className = `node-children ${node.expanded || searchTerm ? 'visible' : ''}`;
          if (this.focusNodeId === node.id) childContainer.style.marginLeft = '0';
          build(node.children, childContainer);
          item.appendChild(childContainer);
        }
        container.appendChild(item);
      });
    };
    build(nodes, this.els.nodesRoot);
  },

  createNodeRow(node) {
    const row = document.createElement('div');
    const depth = this.getNodeDepth(node.id);
    row.className = `node-row ${this.activeNodeId === node.id ? 'active' : ''}`;
    row.dataset.id = node.id;
    row.onclick = (e) => this.handleRowClick(e, node);

    const expander = document.createElement('div');
    expander.className = `node-expander ${node.expanded ? 'expanded' : ''}`;
    expander.innerHTML = node.children.length > 0 ? '▸' : '';
    expander.onclick = (e) => { e.stopPropagation(); node.expanded = !node.expanded; this.render(); };

    const label = document.createElement('div');
    label.className = `node-label depth-${Math.min(depth, 5)}`;
    label.contentEditable = true;
    label.textContent = node.label;
    label.onfocus = () => { this.activeNodeId = node.id; this.renderPreview(); };
    label.oninput = (e) => { 
      node.label = e.target.textContent || '...'; 
      this.renderPreview(); 
      this.updateStats(); 
    };
    label.onblur = () => app.save();

    const actions = document.createElement('div');
    actions.className = 'node-actions';
    actions.innerHTML = `
      <div class="flex flex-col gap-0.5 mr-0.5">
        <button class="w-5 h-4 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-[0.5rem] transition-colors" onclick="app.moveNode('${node.id}', 'up')">▲</button>
        <button class="w-5 h-4 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-[0.5rem] transition-colors" onclick="app.moveNode('${node.id}', 'down')">▼</button>
      </div>
      <button class="action-btn" onclick="UI.focusOnNode('${node.id}')">F</button>
      <button class="action-btn" onclick="app.addNode('${node.id}')">+</button>
      <button class="action-btn text-red-400" onclick="app.deleteNode('${node.id}')">✕</button>
    `;

    row.append(expander, label, actions);
    return row;
  },

  handleRowClick(e, node) {
    if (e.target.classList.contains('node-label') || e.target.closest('button')) return;
    this.activeNodeId = node.id;
    this.render();
  },

  matchesSearch(node, term) {
    if (node.label.toLowerCase().includes(term)) return true;
    return node.children.some(c => this.matchesSearch(c, term));
  },

  getNodeDepth(id) {
    let depth = 0;
    let cur = app.findNode(id);
    while (cur && (cur = app.findParent(cur.id))) depth++;
    return depth;
  },

  // ── PREVIEW RENDERING ──
  renderPreview(previewDropId = null, draggingNode = null) {
    if (!app.data.length) { this.els.ascii.innerHTML = ''; return; }
    let out = '';
    const searchTerm = this.els.search.value.toLowerCase();

    const build = (nodes, prefix = '', isLast = true, isRoot = false, isGhost = false, depth = 0) => {
      nodes.forEach((node, i) => {
        const last = i === nodes.length - 1;
        const conn = isRoot ? '' : (last ? '└─ ' : '├─ ');
        const cPre = isRoot ? '' : prefix + (last ? '   ' : '│  ');
        
        const highlight = !isGhost && this.activeNodeId === node.id ? 'highlight' : '';
        const dragging = !isGhost && this.dragNodeId === node.id ? 'dragging' : '';
        const ghostClass = isGhost ? 'ghost' : '';
        
        // Search Match Logic
        let labelDisplay = this.escape(node.label);
        if (searchTerm && node.label.toLowerCase().includes(searchTerm)) {
          labelDisplay = `<span class="search-match">${labelDisplay}</span>`;
        }

        const depthClass = `depth-${Math.min(depth, 5)}`;
        out += `<span class="branch ${ghostClass}">${prefix}${conn}</span><span class="${isRoot && !isGhost ? 'root-node' : ''} ${highlight} ${dragging} ${ghostClass} ${depthClass} node-text" data-id="${node.id}" draggable="true">${labelDisplay}</span>\n`;
        
        if (node.id === previewDropId && draggingNode) {
          build([draggingNode], cPre, node.children.length === 0, false, true, depth + 1);
        }

        if (node.children.length) {
          build(node.children, cPre, last, false, isGhost, depth + 1);
          
          // Refined Spacing Logic: 
          // Only add spacer line after level-1 nodes (children of absolute root) if they have children and are NOT last
          if (depth === 0 && !last) {
            out += `<span class="branch ${ghostClass}">${prefix}│</span>\n`;
          }
        }
      });
    };

    build(app.data, '', true, true, false, 0);
    this.els.ascii.innerHTML = out;
  },

  // ── EXPORT FUNCTIONS ──
  exportMarkdown() {
    let out = '';
    const build = (nodes, depth = 0) => {
      nodes.forEach(node => {
        const indent = '  '.repeat(depth);
        out += `${indent}- ${node.label}\n`;
        if (node.children.length) build(node.children, depth + 1);
      });
    };
    build(app.data);
    this.downloadFile(out, 'tree.md');
  },

  exportMermaid() {
    let out = 'graph TD\n';
    const build = (nodes) => {
      nodes.forEach(node => {
        const parent = app.findParent(node.id);
        if (parent) {
          out += `  ${parent.id}["${parent.label}"] --> ${node.id}["${node.label}"]\n`;
        } else {
          out += `  ${node.id}["${node.label}"]\n`;
        }
        if (node.children.length) build(node.children);
      });
    };
    build(app.data);
    this.downloadFile(out, 'tree.mmd');
  },

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    this.showToast(`Exported ${filename}`);
  },

  // ── UTILITIES ──
  updateStats() {
    let count = 0, depth = 0;
    app.traverse(n => {
      count++;
      const d = this.getNodeDepth(n.id) + 1;
      depth = Math.max(depth, d);
    });

    this.els.stats.nodes.textContent = `NODES: ${count}`;
    this.els.stats.depth.textContent = `DEPTH: ${depth}`;

    const lastSaved = localStorage.getItem('neural_tree_last_saved');
    if (lastSaved && this.els.saveIndicator) {
      const time = new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.els.saveIndicator.textContent = `LAST_SAVED: ${time}`;
    }
  },

  renderBreadcrumbs() {
    if (!this.focusNodeId) { this.els.breadcrumb.style.display = 'none'; return; }
    this.els.breadcrumb.style.display = 'flex';
    this.els.breadcrumb.innerHTML = '';
    
    const path = [];
    let cur = app.findNode(this.focusNodeId);
    while (cur) {
      path.unshift(cur);
      cur = app.findParent(cur.id);
    }

    const create = (text, id) => {
      const span = document.createElement('span');
      span.className = 'breadcrumb-item';
      span.textContent = text;
      span.onclick = () => { this.focusNodeId = id; this.render(); };
      return span;
    };

    this.els.breadcrumb.appendChild(create('All Nodes', null));
    path.forEach(n => {
      const sep = document.createElement('span'); sep.className = 'breadcrumb-sep'; sep.textContent = ' / ';
      this.els.breadcrumb.append(sep, create(n.label, n.id));
    });
  },

  focusNode(id) {
    const row = document.querySelector(`.node-row[data-id="${id}"]`);
    if (row) {
      const lbl = row.querySelector('.node-label');
      if (lbl) {
        lbl.focus();
        const range = document.createRange();
        range.selectNodeContents(lbl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  },

  focusOnNode(id) { this.focusNodeId = id; this.render(); },

  showToast(m) {
    this.els.toast.textContent = m;
    this.els.toast.classList.add('show');
    setTimeout(() => this.els.toast.classList.remove('show'), 2000);
  },

  setTheme(t) {
    document.body.dataset.theme = t;
    localStorage.setItem('neural_theme', t);
    document.querySelectorAll('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.setTheme === t));
  },

  escape: (t) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; },

  setupEvents() {
    document.getElementById('btn-add-root').onclick = () => app.addNode(null);
    document.getElementById('btn-clear-all').onclick = () => {
      if (confirm("Reset everything?")) {
        app.data = [{ id: '1', label: 'Main Topic', children: [], expanded: true }];
        app.idCounter = 2;
        this.activeNodeId = this.focusNodeId = null;
        app.save();
        this.render();
      }
    };

    this.els.search.oninput = () => this.render();
    
    document.getElementById('btn-copy').onclick = () => {
      navigator.clipboard.writeText(this.els.ascii.innerText).then(() => this.showToast("Copied Tree"));
    };

    document.getElementById('btn-undo').onclick = () => {
      const state = app.history.undo();
      if (state) { app.data = state.data; app.idCounter = state.counter; this.render(); this.showToast("Undo"); }
    };

    document.getElementById('btn-redo').onclick = () => {
      const state = app.history.redo();
      if (state) { app.data = state.data; app.idCounter = state.counter; this.render(); this.showToast("Redo"); }
    };

    document.getElementById('btn-expand-all').onclick = () => {
      const exp = !app.data[0].expanded;
      app.traverse(n => n.expanded = exp);
      this.render();
    };

    document.querySelectorAll('[data-set-theme]').forEach(dot => dot.onclick = () => this.setTheme(dot.dataset.setTheme));
    
    // Drag & Drop
    this.els.ascii.ondragstart = (e) => {
      const node = e.target.closest('.node-text');
      if (node) { this.dragNodeId = node.dataset.id; node.classList.add('dragging'); }
    };
    this.els.ascii.ondragend = () => { this.dragNodeId = this.previewTargetId = null; this.render(); };
    this.els.ascii.ondragover = (e) => {
      e.preventDefault();
      const node = e.target.closest('.node-text');
      if (node && node.dataset.id !== this.dragNodeId) {
        if (this.previewTargetId !== node.dataset.id) { this.previewTargetId = node.dataset.id; this.render(); }
      }
    };
    this.els.ascii.ondrop = (e) => {
      e.preventDefault();
      const target = e.target.closest('.node-text');
      if (target && this.dragNodeId) app.relocateNode(this.dragNodeId, target.dataset.id);
    };

    // Preview Click to Focus
    this.els.ascii.onclick = (e) => {
      const node = e.target.closest('.node-text');
      if (node) {
        this.activeNodeId = node.dataset.id;
        this.render();
        setTimeout(() => {
          const row = document.querySelector(`.node-row[data-id="${node.dataset.id}"]`);
          if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); this.focusNode(node.dataset.id); }
        }, 100);
      }
    };

    document.getElementById('btn-export-json').onclick = () => {
      const blob = new Blob([JSON.stringify(app.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'tree.json'; a.click();
    };

    document.getElementById('btn-export-md').onclick = () => this.exportMarkdown();
    document.getElementById('btn-export-mmd').onclick = () => this.exportMermaid();

    document.getElementById('btn-import').onclick = () => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
      input.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (re) => {
          try {
            const data = JSON.parse(re.target.result);
            app.data = Array.isArray(data) ? data : [data];
            app.syncIdCounter(); app.save(); this.render(); this.showToast("Imported");
          } catch(e) { this.showToast("Invalid JSON"); }
        };
        reader.readAsText(e.target.files[0]);
      };
      input.click();
    };

    document.getElementById('btn-shot').onclick = () => {
      this.showToast("Rendering...");
      html2canvas(this.els.ascii, { backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-surface'), scale: 2 }).then(canvas => {
        const link = document.createElement('a'); link.download = `tree-${Date.now()}.png`; link.href = canvas.toDataURL(); link.click();
        this.showToast("Saved Image");
      });
    };

    document.getElementById('btn-print').onclick = () => window.print();
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); document.getElementById('btn-redo').click(); }
    });
  }
};

window.UI = UI;
