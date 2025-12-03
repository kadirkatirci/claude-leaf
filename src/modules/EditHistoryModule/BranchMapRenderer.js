/**
 * BranchMapRenderer - Branch map'i SVG olarak renderlar
 * 
 * Kurallar:
 * - Aynı mesaj numarası = Aynı yatay hiza (satır)
 * - Sütun sırası: Sol dallar → Ana yol → Sağ dallar
 * - Dal sütunlarında sadece farklı olan mesajlar var
 * - Bağlantılar: Dallanma noktasından (ana yoldaki mesaj) dal sütununa
 */

class BranchMapRenderer {
  constructor(container, data, options = {}) {
    this.container = container;
    this.data = data; // { columns, messageIndices, containerIds, mainPath }
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
    this.rowPositions = new Map();   // messageIndex -> y
    this.columnLayouts = [];         // Her sütunun layout bilgisi
    this.startNodePos = null;
    this.mainColumnLayout = null;    // Ana yol sütunu referansı
  }

  /**
   * Ana render metodu
   */
  render() {
    console.log('[BranchMapRenderer] Starting render with data:', this.data);

    if (!this.data.columns || this.data.columns.length === 0) {
      this.container.innerHTML = '<div class="p-8 text-center text-text-300">No data to display</div>';
      return;
    }

    // 1. Renk haritası oluştur
    this.buildColorMap();

    // 2. Satır pozisyonlarını hesapla
    this.calculateRowPositions();

    // 3. Sütun layout'larını hesapla
    this.calculateColumnLayouts();

    // 4. SVG boyutlarını hesapla
    const bounds = this.calculateBounds();

    // 5. SVG oluştur
    this.createSVG(bounds.width, bounds.height);

    // 6. Sütunları (kutuları) çiz
    this.renderColumns();

    // 7. START node çiz
    this.renderStartNode();

    // 8. Node'ları çiz
    this.renderNodes();

    // 9. Bağlantıları çiz
    this.renderConnections();

    // 10. Legend çiz
    this.renderLegend(bounds.height);

    // 11. Interaktivite ekle
    this.addInteractivity();

    console.log('[BranchMapRenderer] Render complete');
    return this.svg;
  }

  /**
   * Her containerId için renk ata
   */
  buildColorMap() {
    this.data.containerIds.forEach((containerId, index) => {
      this.colorMap.set(containerId, this.options.colors[index % this.options.colors.length]);
    });
  }

  /**
   * Satır pozisyonlarını hesapla
   */
  calculateRowPositions() {
    const { startY, nodeHeight, verticalGap } = this.options;
    
    this.data.messageIndices.forEach((msgIndex, rowIndex) => {
      const y = startY + rowIndex * (nodeHeight + verticalGap);
      this.rowPositions.set(msgIndex, y);
    });
  }

  /**
   * Sütun layout'larını hesapla
   */
  calculateColumnLayouts() {
    const { startX, nodeWidth, horizontalGap, columnPadding, nodeHeight } = this.options;
    
    // START node'dan sonra başla
    let currentX = startX + nodeWidth + horizontalGap;

    this.data.columns.forEach((column) => {
      // Boş sütunları atla
      if (!column.nodes || column.nodes.length === 0) {
        return;
      }

      // Bu sütundaki node'ların pozisyonlarını hesapla
      const nodePositions = column.nodes.map(node => ({
        ...node,
        x: currentX + columnPadding,
        y: this.rowPositions.get(node.messageIndex)
      }));

      // Sütun sınırlarını hesapla
      const ys = nodePositions.map(n => n.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const layout = {
        id: column.id,
        type: column.type,
        divergeFromIndex: column.divergeFromIndex,
        x: currentX,
        y: minY - columnPadding,
        width: nodeWidth + columnPadding * 2,
        height: (maxY - minY) + nodeHeight + columnPadding * 2,
        nodes: nodePositions
      };

      this.columnLayouts.push(layout);
      
      // Ana yol referansını sakla
      if (column.type === 'main') {
        this.mainColumnLayout = layout;
      }

      currentX += layout.width + horizontalGap;
    });
  }

  /**
   * SVG boyutlarını hesapla
   */
  calculateBounds() {
    const { startX, nodeWidth, nodeHeight, startY } = this.options;
    
    let maxX = startX + nodeWidth;
    let maxY = startY + nodeHeight;

    this.columnLayouts.forEach(col => {
      maxX = Math.max(maxX, col.x + col.width);
      maxY = Math.max(maxY, col.y + col.height);
    });

    return {
      width: maxX + 60,
      height: maxY + 80
    };
  }

  /**
   * SVG oluştur
   */
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

  /**
   * START node çiz
   */
  renderStartNode() {
    const { startX, nodeWidth, nodeHeight } = this.options;
    
    // START'ın Y pozisyonu: ilk satırla aynı hizada
    const firstRowY = this.rowPositions.get(this.data.messageIndices[0]) || this.options.startY;

    this.startNodePos = {
      x: startX,
      y: firstRowY,
      width: nodeWidth,
      height: nodeHeight
    };

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

  /**
   * Sütunları (kutuları) çiz
   */
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

  /**
   * Node'ları çiz
   */
  renderNodes() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'nodes');

    this.columnLayouts.forEach(col => {
      col.nodes.forEach(node => {
        const nodeEl = this.createNode(node);
        g.appendChild(nodeEl);
      });
    });

    this.mainGroup.appendChild(g);
  }

  /**
   * Tek bir node elementi oluştur
   */
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

    // Click handler
    g.addEventListener('click', () => {
      const event = new CustomEvent('branchmap:nodeclick', { detail: { node } });
      this.container.dispatchEvent(event);
    });

    // Hover
    g.addEventListener('mouseenter', () => rect.style.filter = 'brightness(1.15)');
    g.addEventListener('mouseleave', () => rect.style.filter = '');

    return g;
  }

  /**
   * Bağlantıları çiz
   */
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
        const path = this.createConnection(
          this.startNodePos.x + this.startNodePos.width,
          this.startNodePos.y + this.startNodePos.height / 2,
          firstNode.x,
          firstNode.y + nodeHeight / 2
        );
        g.appendChild(path);
      }
    }

    // Sol dallardan ana yola bağlantı
    // Dallanma noktası: divergeFromIndex veya ilk satır
    this.columnLayouts.forEach((col, colIndex) => {
      if (col.type === 'left-branch' && this.mainColumnLayout) {
        const firstBranchNode = col.nodes[0];
        if (firstBranchNode) {
          // Dallanma noktasını bul (ana yoldaki mesaj)
          let sourceNode;
          
          if (col.divergeFromIndex === -1) {
            // START'tan dallanıyor - aynı satırdaki ana yol node'una bağlan
            sourceNode = this.mainColumnLayout.nodes.find(
              n => n.messageIndex === firstBranchNode.messageIndex
            );
          } else {
            // Belirli bir mesajdan dallanıyor
            sourceNode = this.mainColumnLayout.nodes.find(
              n => n.messageIndex === col.divergeFromIndex
            );
          }

          // Aynı satırda bağlantı (sol dal → ana yol aynı satır)
          const sameRowMainNode = this.mainColumnLayout.nodes.find(
            n => n.messageIndex === firstBranchNode.messageIndex
          );
          
          if (sameRowMainNode) {
            const path = this.createConnection(
              firstBranchNode.x + nodeWidth,
              firstBranchNode.y + nodeHeight / 2,
              sameRowMainNode.x,
              sameRowMainNode.y + nodeHeight / 2
            );
            g.appendChild(path);
          }
        }
      }
    });

    // Ana yoldan sağ dallara bağlantı
    this.columnLayouts.forEach((col) => {
      if (col.type === 'right-branch' && this.mainColumnLayout) {
        const firstBranchNode = col.nodes[0];
        if (firstBranchNode) {
          // Dallanma noktasını bul
          let sourceNode;
          
          if (col.divergeFromIndex !== undefined && col.divergeFromIndex !== -1) {
            // Belirli bir mesajdan dallanıyor
            sourceNode = this.mainColumnLayout.nodes.find(
              n => n.messageIndex === col.divergeFromIndex
            );
          }
          
          // Aynı satırdaki ana yol node'unu bul
          const sameRowMainNode = this.mainColumnLayout.nodes.find(
            n => n.messageIndex === firstBranchNode.messageIndex
          );
          
          // Dallanma noktasından dal sütununa bağlantı
          if (sourceNode && sourceNode.messageIndex !== firstBranchNode.messageIndex) {
            // Çapraz bağlantı: dallanma noktası → dal'ın ilk node'u
            const path = this.createConnection(
              sourceNode.x + nodeWidth,
              sourceNode.y + nodeHeight / 2,
              firstBranchNode.x,
              firstBranchNode.y + nodeHeight / 2
            );
            g.appendChild(path);
          } else if (sameRowMainNode) {
            // Aynı satır bağlantısı
            const path = this.createConnection(
              sameRowMainNode.x + nodeWidth,
              sameRowMainNode.y + nodeHeight / 2,
              firstBranchNode.x,
              firstBranchNode.y + nodeHeight / 2
            );
            g.appendChild(path);
          }
        }
      }
    });

    // Bağlantıları arkaya al
    this.mainGroup.insertBefore(g, this.mainGroup.firstChild);
  }

  /**
   * Bezier curve bağlantı
   */
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

  /**
   * Legend çiz
   */
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

  /**
   * Zoom/Pan
   */
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
