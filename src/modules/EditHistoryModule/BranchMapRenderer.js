/**
 * BranchMapRenderer - Tree'yi SVG olarak renderlar
 * 
 * Kurallar:
 * - Aynı snapshot'taki ardışık mesajlar: Dikey (kutu içinde alt alta)
 * - Farklı versiyonlar (dallanma): Yatay
 * - Current path: Beyaz border ile vurgulu
 * - Disabled node: Soluk (opacity 0.4)
 * 
 * Görsel:
 * - Her edited message farklı renkte
 * - Kutular rounded rectangle
 * - Bağlantılar bezier curve
 */

class BranchMapRenderer {
  constructor(container, tree, options = {}) {
    this.container = container;
    this.tree = tree;
    this.options = {
      nodeWidth: 70,
      nodeHeight: 36,
      horizontalGap: 80,
      verticalGap: 20,
      groupPadding: 15,
      groupGap: 40,
      startX: 60,
      startY: 60,
      // Renk paleti - her messageIndex için farklı renk
      colors: [
        '#ef4444', // kırmızı
        '#f97316', // turuncu  
        '#eab308', // sarı
        '#22c55e', // yeşil
        '#06b6d4', // cyan
        '#3b82f6', // mavi
        '#8b5cf6', // mor
        '#ec4899', // pembe
      ],
      ...options
    };

    this.svg = null;
    this.positions = new Map(); // nodeId -> {x, y}
    this.groups = [];          // Snapshot grupları
    this.nodeColorMap = new Map(); // containerId -> color
  }

  /**
   * Ana render metodu
   */
  render() {
    console.log('[BranchMapRenderer] Starting render');

    // 1. Renk haritasını oluştur
    this.buildColorMap();

    // 2. Layout hesapla
    const layout = this.calculateLayout();
    console.log('[BranchMapRenderer] Layout calculated:', layout);

    // 3. SVG oluştur
    this.createSVG(layout.width, layout.height);

    // 4. Grupları (snapshot kutuları) çiz
    this.renderGroups();

    // 5. Bağlantıları çiz
    this.renderConnections();

    // 6. Node'ları çiz
    this.renderNodes();

    // 7. START node'u çiz
    this.renderStartNode();

    // 8. Legend ekle
    this.renderLegend(layout.width, layout.height);

    // 9. Zoom/Pan ekle
    this.addInteractivity();

    return this.svg;
  }

  /**
   * Her containerId için renk ata
   */
  buildColorMap() {
    const containerIds = new Set();
    
    this.traverseTree(this.tree, (node) => {
      if (node.containerId) {
        containerIds.add(node.containerId);
      }
    });

    // messageIndex'e göre sırala
    const sorted = Array.from(containerIds).sort((a, b) => {
      const indexA = parseInt(a.replace('edit-index-', ''));
      const indexB = parseInt(b.replace('edit-index-', ''));
      return indexA - indexB;
    });

    sorted.forEach((containerId, index) => {
      this.nodeColorMap.set(containerId, this.options.colors[index % this.options.colors.length]);
    });

    console.log('[BranchMapRenderer] Color map:', this.nodeColorMap);
  }

  /**
   * Layout hesapla - pozisyonları belirle
   */
  calculateLayout() {
    let currentX = this.options.startX + this.options.nodeWidth + this.options.horizontalGap;
    let maxY = this.options.startY;
    let maxX = currentX;

    // START node pozisyonu
    this.positions.set('START', {
      x: this.options.startX,
      y: this.options.startY,
      width: this.options.nodeWidth,
      height: this.options.nodeHeight
    });

    // Tree'yi BFS ile traverse et ve grupları belirle
    this.calculateBranches(this.tree, currentX, this.options.startY);

    // Max değerleri hesapla
    this.positions.forEach((pos) => {
      maxX = Math.max(maxX, pos.x + (pos.width || this.options.nodeWidth));
      maxY = Math.max(maxY, pos.y + (pos.height || this.options.nodeHeight));
    });

    this.groups.forEach(group => {
      maxX = Math.max(maxX, group.x + group.width);
      maxY = Math.max(maxY, group.y + group.height);
    });

    return {
      width: maxX + 100,
      height: maxY + 100
    };
  }

  /**
   * Branch'ları hesapla ve grupla
   */
  calculateBranches(node, startX, startY) {
    if (node.id === 'START') {
      // Root'un her child'ı bir branch başlangıcı
      let branchY = startY;
      
      node.children.forEach((child, index) => {
        const branchHeight = this.calculateBranchLayout(child, startX, branchY);
        branchY += branchHeight + this.options.groupGap;
      });
      
      return;
    }
  }

  /**
   * Tek bir branch'ın layout'unu hesapla
   * Aynı snapshot'taki ardışık mesajları grupla
   */
  calculateBranchLayout(startNode, startX, startY) {
    // Bu branch'taki tüm node'ları topla (depth-first, tek yol)
    const branchNodes = [];
    let currentNode = startNode;
    
    // Ana yolu takip et (ilk child'ı takip ederek)
    while (currentNode) {
      branchNodes.push(currentNode);
      
      // Dallanma var mı kontrol et
      if (currentNode.children.length > 1) {
        // Dallanma noktası - bu grubu bitir ve dalları hesapla
        break;
      }
      
      currentNode = currentNode.children[0] || null;
    }

    // Grup oluştur
    const groupHeight = branchNodes.length * (this.options.nodeHeight + this.options.verticalGap) 
                       - this.options.verticalGap + this.options.groupPadding * 2;
    const groupWidth = this.options.nodeWidth + this.options.groupPadding * 2;

    const group = {
      x: startX,
      y: startY,
      width: groupWidth,
      height: groupHeight,
      nodes: branchNodes,
      isCurrent: branchNodes.some(n => n.isCurrent)
    };
    this.groups.push(group);

    // Node pozisyonlarını hesapla
    branchNodes.forEach((node, index) => {
      this.positions.set(node.id, {
        x: startX + this.options.groupPadding,
        y: startY + this.options.groupPadding + index * (this.options.nodeHeight + this.options.verticalGap),
        width: this.options.nodeWidth,
        height: this.options.nodeHeight
      });
    });

    // Dallanma varsa, dalları hesapla
    const lastNode = branchNodes[branchNodes.length - 1];
    if (lastNode && lastNode.children.length > 1) {
      let branchY = startY;
      const nextX = startX + groupWidth + this.options.horizontalGap;

      lastNode.children.forEach((child, index) => {
        const childHeight = this.calculateBranchLayout(child, nextX, branchY);
        branchY += childHeight + this.options.groupGap;
      });

      // Grup yüksekliğini güncelle (dalların toplam yüksekliği)
      const totalBranchHeight = branchY - startY - this.options.groupGap;
      if (totalBranchHeight > groupHeight) {
        group.height = Math.max(groupHeight, totalBranchHeight);
      }

      return Math.max(groupHeight, totalBranchHeight);
    } else if (lastNode && lastNode.children.length === 1) {
      // Tek child var - devam et
      const nextX = startX + groupWidth + this.options.horizontalGap;
      const childHeight = this.calculateBranchLayout(lastNode.children[0], nextX, startY);
      return Math.max(groupHeight, childHeight);
    }

    return groupHeight;
  }

  /**
   * SVG elementi oluştur
   */
  createSVG(width, height) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.style.background = 'var(--bg-000)';
    this.svg.style.minWidth = `${width}px`;
    this.svg.style.minHeight = `${height}px`;

    // Ana grup (zoom/pan için)
    this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mainGroup.setAttribute('class', 'main-group');
    this.svg.appendChild(this.mainGroup);

    this.container.appendChild(this.svg);
  }

  /**
   * Snapshot gruplarını (kutular) çiz
   */
  renderGroups() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'groups');

    this.groups.forEach(group => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', group.x);
      rect.setAttribute('y', group.y);
      rect.setAttribute('width', group.width);
      rect.setAttribute('height', group.height);
      rect.setAttribute('rx', '12');
      rect.setAttribute('fill', 'var(--bg-100)');
      rect.setAttribute('stroke', group.isCurrent ? 'var(--accent-500)' : 'var(--border-300)');
      rect.setAttribute('stroke-width', group.isCurrent ? '2' : '1');
      rect.setAttribute('stroke-opacity', '0.5');

      g.appendChild(rect);
    });

    this.mainGroup.appendChild(g);
  }

  /**
   * Bağlantıları çiz
   */
  renderConnections() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'connections');

    // START'tan ilk node'lara
    const startPos = this.positions.get('START');
    this.tree.children.forEach(child => {
      if (this.positions.has(child.id)) {
        const childPos = this.positions.get(child.id);
        const path = this.createConnection(
          startPos.x + startPos.width,
          startPos.y + startPos.height / 2,
          childPos.x,
          childPos.y + childPos.height / 2,
          child.isCurrent
        );
        g.appendChild(path);
      }
    });

    // Gruplar arası bağlantılar
    this.groups.forEach(group => {
      const lastNode = group.nodes[group.nodes.length - 1];
      if (lastNode && lastNode.children) {
        const lastPos = this.positions.get(lastNode.id);
        
        lastNode.children.forEach(child => {
          if (this.positions.has(child.id)) {
            const childPos = this.positions.get(child.id);
            const path = this.createConnection(
              group.x + group.width,
              lastPos.y + lastPos.height / 2,
              childPos.x,
              childPos.y + childPos.height / 2,
              child.isCurrent
            );
            g.appendChild(path);
          }
        });
      }
    });

    this.mainGroup.appendChild(g);
  }

  /**
   * Bezier curve bağlantı oluştur
   */
  createConnection(x1, y1, x2, y2, isCurrent) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', isCurrent ? 'var(--accent-500)' : 'var(--border-300)');
    path.setAttribute('stroke-width', isCurrent ? '2.5' : '1.5');
    path.setAttribute('stroke-opacity', isCurrent ? '0.8' : '0.4');

    return path;
  }

  /**
   * Node'ları çiz
   */
  renderNodes() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'nodes');

    this.traverseTree(this.tree, (node) => {
      if (node.id !== 'START' && this.positions.has(node.id)) {
        const pos = this.positions.get(node.id);
        const nodeGroup = this.createNode(node, pos);
        g.appendChild(nodeGroup);
      }
    });

    this.mainGroup.appendChild(g);
  }

  /**
   * Tek bir node elementi oluştur
   */
  createNode(node, pos) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    g.setAttribute('class', 'node');
    g.style.cursor = 'pointer';

    const color = this.nodeColorMap.get(node.containerId) || '#6366f1';
    const opacity = node.disabled ? 0.35 : 1;

    // Kutu
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', pos.width);
    rect.setAttribute('height', pos.height);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', color);
    rect.setAttribute('opacity', opacity);
    
    if (node.isCurrent && !node.disabled) {
      rect.setAttribute('stroke', '#ffffff');
      rect.setAttribute('stroke-width', '2.5');
    }

    // Versiyon text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pos.width / 2);
    text.setAttribute('y', pos.height / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '13');
    text.setAttribute('font-weight', '600');
    text.setAttribute('opacity', opacity);
    text.textContent = node.version;

    // Tooltip
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    const msgIndex = node.containerId?.replace('edit-index-', '') || '';
    title.textContent = `Message #${msgIndex}\n${node.contentPreview || node.content || ''}`;

    g.appendChild(rect);
    g.appendChild(text);
    g.appendChild(title);

    // Click handler
    g.addEventListener('click', () => {
      const event = new CustomEvent('branchmap:nodeclick', {
        detail: { node }
      });
      this.container.dispatchEvent(event);
    });

    // Hover effect
    g.addEventListener('mouseenter', () => {
      rect.setAttribute('filter', 'brightness(1.1)');
      g.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(1.05)`;
    });

    g.addEventListener('mouseleave', () => {
      rect.removeAttribute('filter');
      g.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(1)`;
    });

    return g;
  }

  /**
   * START node'u çiz
   */
  renderStartNode() {
    const pos = this.positions.get('START');
    if (!pos) return;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    g.setAttribute('class', 'start-node');

    // Kutu
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', pos.width);
    rect.setAttribute('height', pos.height);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', 'var(--bg-300)');
    rect.setAttribute('stroke', 'var(--border-300)');
    rect.setAttribute('stroke-width', '1');

    // Text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pos.width / 2);
    text.setAttribute('y', pos.height / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', 'var(--text-200)');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-weight', '600');
    text.textContent = 'START';

    g.appendChild(rect);
    g.appendChild(text);

    this.mainGroup.appendChild(g);
  }

  /**
   * Legend çiz
   */
  renderLegend(width, height) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'legend');
    g.setAttribute('transform', `translate(20, ${height - 50})`);

    let x = 0;

    // Mesaj renkleri
    this.nodeColorMap.forEach((color, containerId) => {
      const msgIndex = containerId.replace('edit-index-', '');

      // Renk kutusu
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', 0);
      rect.setAttribute('width', 14);
      rect.setAttribute('height', 14);
      rect.setAttribute('rx', '3');
      rect.setAttribute('fill', color);

      // Label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + 20);
      text.setAttribute('y', 11);
      text.setAttribute('fill', 'var(--text-300)');
      text.setAttribute('font-size', '11');
      text.textContent = `msg#${msgIndex}`;

      g.appendChild(rect);
      g.appendChild(text);

      x += 75;
    });

    // Current indicator
    const currentRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    currentRect.setAttribute('x', x + 15);
    currentRect.setAttribute('y', 0);
    currentRect.setAttribute('width', 14);
    currentRect.setAttribute('height', 14);
    currentRect.setAttribute('rx', '3');
    currentRect.setAttribute('fill', 'var(--accent-500)');
    currentRect.setAttribute('stroke', '#fff');
    currentRect.setAttribute('stroke-width', '2');

    const currentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    currentText.setAttribute('x', x + 35);
    currentText.setAttribute('y', 11);
    currentText.setAttribute('fill', 'var(--text-300)');
    currentText.setAttribute('font-size', '11');
    currentText.textContent = 'current';

    g.appendChild(currentRect);
    g.appendChild(currentText);

    // Disabled indicator
    x += 90;
    const disabledRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    disabledRect.setAttribute('x', x + 15);
    disabledRect.setAttribute('y', 0);
    disabledRect.setAttribute('width', 14);
    disabledRect.setAttribute('height', 14);
    disabledRect.setAttribute('rx', '3');
    disabledRect.setAttribute('fill', 'var(--text-300)');
    disabledRect.setAttribute('opacity', '0.35');

    const disabledText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    disabledText.setAttribute('x', x + 35);
    disabledText.setAttribute('y', 11);
    disabledText.setAttribute('fill', 'var(--text-300)');
    disabledText.setAttribute('font-size', '11');
    disabledText.textContent = 'uncaptured';

    g.appendChild(disabledRect);
    g.appendChild(disabledText);

    this.mainGroup.appendChild(g);
  }

  /**
   * Zoom/Pan interaktivitesi ekle
   */
  addInteractivity() {
    let isPanning = false;
    let startX, startY;
    let currentTransform = { x: 0, y: 0, scale: 1 };

    // Pan
    this.svg.addEventListener('mousedown', (e) => {
      if (e.target === this.svg || e.target.closest('.groups')) {
        isPanning = true;
        startX = e.clientX - currentTransform.x;
        startY = e.clientY - currentTransform.y;
        this.svg.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      currentTransform.x = e.clientX - startX;
      currentTransform.y = e.clientY - startY;
      this.updateTransform(currentTransform);
    });

    document.addEventListener('mouseup', () => {
      isPanning = false;
      this.svg.style.cursor = 'default';
    });

    // Zoom
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      currentTransform.scale = Math.min(Math.max(currentTransform.scale * delta, 0.3), 3);
      this.updateTransform(currentTransform);
    });
  }

  /**
   * Transform güncelle
   */
  updateTransform(transform) {
    this.mainGroup.setAttribute(
      'transform',
      `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`
    );
  }

  /**
   * Tree'yi traverse et
   */
  traverseTree(node, callback) {
    callback(node);
    node.children?.forEach(child => this.traverseTree(child, callback));
  }
}

export default BranchMapRenderer;
