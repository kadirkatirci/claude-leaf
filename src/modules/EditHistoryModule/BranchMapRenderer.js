/**
 * BranchMapRenderer - Branch map'i SVG olarak renderlar
 * 
 * Kurallar:
 * - Aynı mesaj numarası = Aynı yatay hiza (satır)
 * - Sütun sırası: Sol dallar → Ana yol → Sağ dallar
 * - Duplicate node'lar filtrelenmiş durumda
 * - Bağlantılar: connectFrom bilgisine göre çizilir
 */

class BranchMapRenderer {
  constructor(container, data, options = {}) {
    this.container = container;
    this.data = data;
    this.options = {
      nodeWidth: 70,
      nodeHeight: 36,
      horizontalGap: 30,
      verticalGap: 16,
      columnPadding: 12,
      startX: 80,
      startY: 50,
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
    this.mainGroup = null;
    this.colorMap = new Map();
    this.rowPositions = new Map();
    this.columnLayouts = [];
    this.startNodePos = null;
    this.nodePositionMap = new Map(); // "containerId:version" -> {x, y, columnId}
  }

  render() {
    console.log('[BranchMapRenderer] Starting render with data:', this.data);

    if (!this.data.columns || this.data.columns.length === 0) {
      this.container.innerHTML = '<div class="p-8 text-center text-text-300">No data to display</div>';
      return;
    }

    this.buildColorMap();
    this.calculateRowPositions();
    this.calculateColumnLayouts();
    
    const bounds = this.calculateBounds();
    this.createSVG(bounds.width, bounds.height);
    
    this.renderColumns();
    this.renderStartNode();
    this.renderNodes();
    this.renderConnections();
    this.renderLegend(bounds.height);
    this.addInteractivity();

    console.log('[BranchMapRenderer] Render complete');
    return this.svg;
  }

  buildColorMap() {
    this.data.containerIds.forEach((containerId, index) => {
      this.colorMap.set(containerId, this.options.colors[index % this.options.colors.length]);
    });
  }

  calculateRowPositions() {
    const { startY, nodeHeight, verticalGap } = this.options;
    this.data.messageIndices.forEach((msgIndex, rowIndex) => {
      const y = startY + rowIndex * (nodeHeight + verticalGap);
      this.rowPositions.set(msgIndex, y);
    });
  }

  calculateColumnLayouts() {
    const { startX, nodeWidth, horizontalGap, columnPadding, nodeHeight } = this.options;
    let currentX = startX + nodeWidth + horizontalGap;

    this.data.columns.forEach((column) => {
      if (!column.nodes || column.nodes.length === 0) return;

      const nodePositions = column.nodes.map(node => {
        const pos = {
          ...node,
          x: currentX + columnPadding,
          y: this.rowPositions.get(node.messageIndex)
        };
        
        // Node pozisyonunu kaydet (bağlantılar için)
        const nodeKey = `${node.containerId}:${node.version}`;
        this.nodePositionMap.set(nodeKey, {
          x: pos.x,
          y: pos.y,
          columnId: column.id
        });
        
        return pos;
      });

      const ys = nodePositions.map(n => n.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const layout = {
        id: column.id,
        type: column.type,
        connectFrom: column.connectFrom,
        x: currentX,
        y: minY - columnPadding,
        width: nodeWidth + columnPadding * 2,
        height: (maxY - minY) + nodeHeight + columnPadding * 2,
        nodes: nodePositions
      };

      this.columnLayouts.push(layout);
      currentX += layout.width + horizontalGap;
    });
  }

  calculateBounds() {
    const { startX, nodeWidth, nodeHeight, startY } = this.options;
    let maxX = startX + nodeWidth;
    let maxY = startY + nodeHeight;

    this.columnLayouts.forEach(col => {
      maxX = Math.max(maxX, col.x + col.width);
      maxY = Math.max(maxY, col.y + col.height);
    });

    return { width: maxX + 60, height: maxY + 80 };
  }

  createSVG(width, height) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.style.background = 'var(--bg-000)';
    this.svg.style.minWidth = `${width}px`;
    this.svg.style.minHeight = `${height}px`;

    this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mainGroup.setAttribute('class', 'main-group');
    this.svg.appendChild(this.mainGroup);
    this.container.appendChild(this.svg);
  }

  renderStartNode() {
    const { startX, nodeWidth, nodeHeight } = this.options;
    const firstRowY = this.rowPositions.get(this.data.messageIndices[0]) || this.options.startY;

    this.startNodePos = { x: startX, y: firstRowY, width: nodeWidth, height: nodeHeight };

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${startX}, ${firstRowY})`);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', nodeWidth);
    rect.setAttribute('height', nodeHeight);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', 'var(--bg-300)');
    rect.setAttribute('stroke', 'var(--border-300)');
    rect.setAttribute('stroke-width', '1');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', nodeWidth / 2);
    text.setAttribute('y', nodeHeight / 2);
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

  renderColumns() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'columns');

    this.columnLayouts.forEach(col => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', col.x);
      rect.setAttribute('y', col.y);
      rect.setAttribute('width', col.width);
      rect.setAttribute('height', col.height);
      rect.setAttribute('rx', '12');
      rect.setAttribute('fill', 'var(--bg-100)');
      rect.setAttribute('stroke', 'var(--border-300)');
      rect.setAttribute('stroke-width', '1');
      rect.setAttribute('stroke-opacity', '0.5');
      g.appendChild(rect);
    });

    this.mainGroup.appendChild(g);
  }

  renderNodes() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'nodes');

    this.columnLayouts.forEach(col => {
      col.nodes.forEach(node => {
        g.appendChild(this.createNode(node));
      });
    });

    this.mainGroup.appendChild(g);
  }

  createNode(node) {
    const { nodeWidth, nodeHeight } = this.options;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    g.setAttribute('class', 'node');
    g.style.cursor = 'pointer';

    const color = this.colorMap.get(node.containerId) || '#6366f1';

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', nodeWidth);
    rect.setAttribute('height', nodeHeight);
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', color);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', nodeWidth / 2);
    text.setAttribute('y', nodeHeight / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '13');
    text.setAttribute('font-weight', '600');
    text.textContent = node.version;

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `Message #${node.messageIndex}\n${node.contentPreview || ''}`;

    g.appendChild(rect);
    g.appendChild(text);
    g.appendChild(title);

    g.addEventListener('click', () => {
      this.container.dispatchEvent(new CustomEvent('branchmap:nodeclick', { detail: { node } }));
    });
    g.addEventListener('mouseenter', () => rect.style.filter = 'brightness(1.15)');
    g.addEventListener('mouseleave', () => rect.style.filter = '');

    return g;
  }

  renderConnections() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'connections');

    const { nodeWidth, nodeHeight } = this.options;
    const firstRowIndex = this.data.messageIndices[0];

    // START'tan ilk sütunun ilk satırındaki node'a bağlantı
    const firstColumn = this.columnLayouts[0];
    if (firstColumn) {
      const firstNode = firstColumn.nodes.find(n => n.messageIndex === firstRowIndex);
      if (firstNode) {
        g.appendChild(this.createConnection(
          this.startNodePos.x + this.startNodePos.width,
          this.startNodePos.y + this.startNodePos.height / 2,
          firstNode.x,
          firstNode.y + nodeHeight / 2
        ));
      }
    }

    // Her sütun için connectFrom bilgisine göre bağlantı
    this.columnLayouts.forEach((col, colIndex) => {
      // İlk sütun START'a bağlı, zaten çizildi
      if (colIndex === 0) return;
      
      const firstNodeInColumn = col.nodes[0];
      if (!firstNodeInColumn) return;

      // connectFrom bilgisi varsa kullan
      if (col.connectFrom) {
        const sourceNodeKey = `${col.connectFrom.node.containerId}:${col.connectFrom.node.version}`;
        const sourcePos = this.nodePositionMap.get(sourceNodeKey);
        
        if (sourcePos) {
          g.appendChild(this.createConnection(
            sourcePos.x + nodeWidth,
            sourcePos.y + nodeHeight / 2,
            firstNodeInColumn.x,
            firstNodeInColumn.y + nodeHeight / 2
          ));
          return;
        }
      }

      // connectFrom yoksa, önceki sütundan aynı satıra veya en yakın node'a bağlan
      const prevColumn = this.columnLayouts[colIndex - 1];
      if (prevColumn) {
        // Aynı satırda node var mı?
        let sourceNode = prevColumn.nodes.find(n => n.messageIndex === firstNodeInColumn.messageIndex);
        
        // Yoksa en yakın (daha küçük messageIndex) node'u bul
        if (!sourceNode) {
          const candidates = prevColumn.nodes.filter(n => n.messageIndex < firstNodeInColumn.messageIndex);
          if (candidates.length > 0) {
            sourceNode = candidates.reduce((best, n) => 
              n.messageIndex > best.messageIndex ? n : best
            );
          }
        }
        
        // Hala yoksa ilk node'u kullan
        if (!sourceNode) {
          sourceNode = prevColumn.nodes[0];
        }

        if (sourceNode) {
          g.appendChild(this.createConnection(
            sourceNode.x + nodeWidth,
            sourceNode.y + nodeHeight / 2,
            firstNodeInColumn.x,
            firstNodeInColumn.y + nodeHeight / 2
          ));
        }
      }
    });

    this.mainGroup.insertBefore(g, this.mainGroup.firstChild);
  }

  createConnection(x1, y1, x2, y2) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--border-300)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-opacity', '0.6');

    return path;
  }

  renderLegend(svgHeight) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'legend');
    g.setAttribute('transform', `translate(20, ${svgHeight - 40})`);

    let x = 0;
    this.colorMap.forEach((color, containerId) => {
      const msgIndex = containerId.replace('edit-index-', '');

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', 0);
      rect.setAttribute('width', 14);
      rect.setAttribute('height', 14);
      rect.setAttribute('rx', '3');
      rect.setAttribute('fill', color);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + 20);
      text.setAttribute('y', 11);
      text.setAttribute('fill', 'var(--text-300)');
      text.setAttribute('font-size', '11');
      text.textContent = `msg#${msgIndex}`;

      g.appendChild(rect);
      g.appendChild(text);
      x += 80;
    });

    this.mainGroup.appendChild(g);
  }

  addInteractivity() {
    let isPanning = false;
    let startX, startY;
    let transform = { x: 0, y: 0, scale: 1 };

    this.svg.addEventListener('mousedown', (e) => {
      if (e.target === this.svg || e.target.closest('.columns')) {
        isPanning = true;
        startX = e.clientX - transform.x;
        startY = e.clientY - transform.y;
        this.svg.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      transform.x = e.clientX - startX;
      transform.y = e.clientY - startY;
      this.mainGroup.setAttribute('transform', 
        `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`);
    });

    document.addEventListener('mouseup', () => {
      isPanning = false;
      this.svg.style.cursor = 'default';
    });

    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      transform.scale = Math.min(Math.max(transform.scale * delta, 0.3), 3);
      this.mainGroup.setAttribute('transform',
        `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`);
    });
  }
}

export default BranchMapRenderer;
