'use strict';

/**
 * TreeManager handles the data structure, persistence, and history.
 */
class TreeManager {
  constructor() {
    this.data = [{ id: '1', label: 'Main Topic', children: [], expanded: true }];
    this.idCounter = 2;
    this.history = {
      stack: [],
      index: -1,
      push: (data, counter) => {
        this.history.stack = this.history.stack.slice(0, this.history.index + 1);
        this.history.stack.push(JSON.parse(JSON.stringify({ data, counter })));
        if (this.history.stack.length > 50) this.history.stack.shift();
        this.history.index = this.history.stack.length - 1;
      },
      undo: () => {
        if (this.history.index <= 0) return null;
        return JSON.parse(JSON.stringify(this.history.stack[--this.history.index]));
      },
      redo: () => {
        if (this.history.index >= this.history.stack.length - 1) return null;
        return JSON.parse(JSON.stringify(this.history.stack[++this.history.index]));
      }
    };
  }

  save(record = true) {
    const state = { data: this.data, counter: this.idCounter };
    localStorage.setItem('neural_tree_v6', JSON.stringify(state));
    localStorage.setItem('neural_tree_last_saved', new Date().toISOString());
    
    if (record) this.history.push(this.data, this.idCounter);
    if (window.UI) window.UI.updateStats();
  }

  load() {
    const saved = localStorage.getItem('neural_tree_v6');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        this.data = p.data;
        this.idCounter = p.counter;
      } catch (e) { console.error("Load failed", e); }
    }
    this.syncIdCounter();
    this.history.push(this.data, this.idCounter);
  }

  syncIdCounter() {
    let max = 0;
    this.traverse(node => {
      const idNum = parseInt(node.id);
      if (!isNaN(idNum)) max = Math.max(max, idNum);
    });
    this.idCounter = max + 1;
  }

  traverse(callback, nodes = this.data) {
    nodes.forEach(node => {
      callback(node);
      if (node.children) this.traverse(callback, node.children);
    });
  }

  findNode(id, nodes = this.data) {
    for (const n of nodes) {
      if (n.id === id) return n;
      const f = this.findNode(id, n.children);
      if (f) return f;
    }
    return null;
  }

  findParent(childId, nodes = this.data, parent = null) {
    for (const n of nodes) {
      if (n.id === childId) return parent;
      const f = this.findParent(childId, n.children, n);
      if (f) return f;
    }
    return null;
  }

  addNode(parentId, siblingAfterId = null) {
    let label = "New Topic";
    if (parentId === null) {
      label = `Topic ${this.idCounter}`;
    } else {
      const p = this.findNode(parentId);
      if (p) label = `Subtopic of ${p.label}`;
    }

    const newNode = { id: String(this.idCounter++), label, children: [], expanded: true };
    
    if (parentId === null) {
      if (siblingAfterId) {
        const idx = this.data.findIndex(n => n.id === siblingAfterId);
        this.data.splice(idx + 1, 0, newNode);
      } else {
        this.data.push(newNode);
      }
    } else {
      const p = this.findNode(parentId);
      if (p) {
        if (siblingAfterId) {
          const idx = p.children.findIndex(n => n.id === siblingAfterId);
          p.children.splice(idx + 1, 0, newNode);
        } else {
          p.children.push(newNode);
        }
        p.expanded = true;
      }
    }
    UI.activeNodeId = newNode.id;
    this.save();
    UI.render();
    setTimeout(() => UI.focusNode(newNode.id), 50);
  }

  deleteNode(id) {
    const del = (ns) => {
      const i = ns.findIndex(n => n.id === id);
      if (i !== -1) { ns.splice(i, 1); return true; }
      return ns.some(n => del(n.children));
    };
    del(this.data);
    if (UI.activeNodeId === id) UI.activeNodeId = null;
    if (UI.focusNodeId === id) UI.focusNodeId = null;
    this.save();
    UI.render();
  }

  moveNode(id, direction) {
    const parent = this.findParent(id);
    const siblings = parent ? parent.children : this.data;
    const idx = siblings.findIndex(n => n.id === id);
    
    if (direction === 'up' && idx > 0) {
      [siblings[idx], siblings[idx - 1]] = [siblings[idx - 1], siblings[idx]];
    } else if (direction === 'down' && idx < siblings.length - 1) {
      [siblings[idx], siblings[idx + 1]] = [siblings[idx + 1], siblings[idx]];
    } else {
      UI.showToast(`Already at ${direction}`);
      return;
    }
    this.save();
    UI.render();
  }

  relocateNode(id, targetId) {
    if (id === targetId) return;
    const movingNode = this.findNode(id);
    const targetNode = this.findNode(targetId);
    if (!movingNode || !targetNode) return;

    const isDescendant = (parent, childId) => parent.children.some(c => c.id === childId || isDescendant(c, childId));
    if (isDescendant(movingNode, targetId)) {
      UI.showToast("Cannot move into descendant");
      return;
    }

    const oldParent = this.findParent(id);
    const siblings = oldParent ? oldParent.children : this.data;
    siblings.splice(siblings.findIndex(n => n.id === id), 1);

    targetNode.children.push(movingNode);
    targetNode.expanded = true;
    UI.activeNodeId = id;
    this.save();
    UI.render();
  }
}

window.TreeManager = TreeManager;
