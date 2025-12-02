/**
 * BranchMapRenderer - Branch map'i SVG olarak renderlar
 * 
 * Kurallar:
 * - Aynı mesaj numarası = aynı yatay hiza (satır)
 * - Her sütun bir snapshot path'inin benzersiz kısmı
 * - Yalnız sütunlar: O versiyondan sonra devam eden snapshot yok
 * - Bağlantılar: Sütunlar arası mantıksal akış
 */

class BranchMapRenderer {
  constructor(container, data, options = {}) {
    this.container = container;
    this.data = data; // { columns, messageIndices, containerIds, paths }
    this.options = {
      nodeWidth: 70,
      nodeHeight: 36,
      horizontalGap: 30,      // Sütunlar arası boşluk
      verticalGap: 16,        // Satırlar arası boşluk
      columnPadding: 12,      // Sütun içi padding
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
    this.colorMap = new Map();      // containerId -> color
    this.rowPositions = new Map();  // messageIndex -> y position
    this.columnLayouts = [];        // Her sütunun layout bilgisi
  }

  /**
   * Ana render metodu
   */
  render() {
    console.log('[BranchMapRenderer] Starting render');

    // 1. Renk haritası oluştur
    this.buildColorMap();

    // 2. Satır pozisyonlarını hesapla (yatay hiza)
    this.calculateRowPositions();

    // 3. Sütun layout'larını hesapla
    this.calculateColumnLayouts();

    // 4. SVG boyutlarını hesapla
    const bounds = this.calculateBounds();

    // 5. SVG oluştur
    this.createSVG(bounds.width, bounds.height);

    // 6. START node çiz
    this.renderStartNode();

    // 7. Sütunları (kutuları) çiz
    this.renderColumns();

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
    console.log('[BranchMapRenderer] Color map:', this.colorMap);
  }

  /**
   * Satır pozisyonlarını hesapla
   * Her messageIndex için sabit bir Y pozisyonu
   */
  calculateRowPositions() {
    const { startY, nodeHeight, verticalGap } = this.options;
    
    this.data.messageIndices.forEach((msgIndex, rowIndex) => {
      const y = startY + rowIndex * (nodeHeight + verticalGap);
      this.rowPositions.set(msgIndex, y);
    });
    
    console.log('[BranchMapRenderer] Row positions:', this.rowPositions);
  }

  /**
   * Sütun layout'larını hesapla
   */
  calculateColumnLayouts() {
    const { startX, nodeWidth, horizontalGap, columnPadding } = this.options;
    
    let currentX = startX + nodeWidth + horizontalGap; // START'tan sonra
    
    this.data.columns.forEach((column, colIndex) => {
      // Bu sütundaki mesajların Y pozisyonlarını bul
      const nodePositions = column.messages.map(msg => ({
        ...msg,
        y: this.rowPositions.get(msg.messageIndex)
      }));

      // Sütun sınırlarını hesapla
      const minY = Math.min(...nodePositions.map(n => n.y));
      const maxY = Math.max(...nodePositions.map(n => n.y));
      
      const columnLayout = {
        id: column.id,
        x: currentX,
        y: minY - columnPadding,
        width: nodeWidth + columnPadding * 2,
        height: (maxY - minY) + this.options.nodeHeight + columnPadding * 2,
        nodes: nodePositions.map(n => ({
          ...n,
          x: currentX + columnPadding,
          y: n.y
        })),
        isAlone: column.isAlone,
        snapshotId: column.snapshotId
      };

      this.columnLayouts.push(columnLayout);
      currentX += columnLayout.width + horizontalGap;
    });

    console.log('[BranchMapRenderer] Column layouts:', this.columnLayouts);
  }

  /**
   * SVG boyutlarını hesapla
   */
  calculateBounds() {
    let maxX = this.options.startX + this.options.nodeWidth; // START node
    let maxY = this.options.startY + this.options.nodeHeight;

    this.columnLayouts.forEach(col => {
      maxX = Math.max(maxX, col.x + col.width);
      maxY = Math.max(maxY, col.y + col.height);
    });

    return {
      width: maxX + 60,
      height: maxY + 80 // Legend için alan
    };
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

    this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mainGroup.setAttribute('class', 'main-group');
    this.svg.appendChild(this.mainGroup);

    this.container.appendChild(this.svg);
  }

  /**
   * START node çiz
   */
  renderStartNode() {
    const { startX, startY, nodeWidth, nodeHeight } = this.options;
    
    // START'ın Y pozisyonu: ilk satırla aynı hizada
    const firstRowY = this.rowPositions.get(this.data.messageIndices[0]) || startY;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${startX}, ${firstRowY})`);
    g.setAttribute('class', 'start-node');

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

    // START pozisyonunu sakla (bağlantılar için)
    this.startNodePos = {
      x: startX,
      y: firstRowY,
      width: nodeWidth,
      height: nodeHeight
    };
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

    // Kutu
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', nodeWidth);
    rect.setAttribute('height', nodeHeight);
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', color);

    // Versiyon text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', nodeWidth / 2);
    text.setAttribute('y', nodeHeight / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '13');
    text.setAttribute('font-weight', '600');
    text.textContent = node.version;

    // Tooltip
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    const msgIndex = node.containerId?.replace('edit-index-', '') || '';
    title.textContent = `Message #${msgIndex}\n${node.contentPreview || ''}`;

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
      rect.style.filter = 'brightness(1.15)';
    });
    g.addEventListener('mouseleave', () => {
      rect.style.filter = '';
    });

    return g;
  }

  /**
   * Bağlantıları çiz
   */
  renderConnections() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'connections');

    const { nodeWidth, nodeHeight } = this.options;

    // START'tan ilk sütunlara bağlantı
    // İlk satırdaki (en küçük messageIndex) node'lara bağlan
    const firstRowIndex = this.data.messageIndices[0];
    
    this.columnLayouts.forEach(col => {
      const firstNodeInColumn = col.nodes.find(n => n.messageIndex === firstRowIndex);
      if (firstNodeInColumn) {
        const path = this.createConnection(
          this.startNodePos.x + this.startNodePos.width,
          this.startNodePos.y + this.startNodePos.height / 2,
          firstNodeInColumn.x,
          firstNodeInColumn.y + nodeHeight / 2
        );
        g.appendChild(path);
      }
    });

    // Sütunlar arası bağlantılar
    // Yalnız sütunlardan, aynı satırdaki diğer sütunlara bağlantı
    this.columnLayouts.forEach((col, colIndex) => {
      if (col.isAlone) {
        // Bu yalnız sütun - aynı satırdaki sonraki sütuna bağlan
        const lastNode = col.nodes[col.nodes.length - 1];
        
        // Aynı satırda başlayan sonraki sütunu bul
        for (let i = colIndex + 1; i < this.columnLayouts.length; i++) {
          const nextCol = this.columnLayouts[i];
          const matchingNode = nextCol.nodes.find(n => n.messageIndex === lastNode.messageIndex);
          
          if (matchingNode) {
            const path = this.createConnection(
              lastNode.x + nodeWidth,
              lastNode.y + nodeHeight / 2,
              matchingNode.x,
              matchingNode.y + nodeHeight / 2
            );
            g.appendChild(path);
            break;
          }
        }
      }
    });

    // Bu grubu arkaya al (node'ların altında)
    this.mainGroup.insertBefore(g, this.mainGroup.firstChild);
  }

  /**
   * Bezier curve bağlantı oluştur
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

    // Mesaj renkleri
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
   * Zoom/Pan interaktivitesi ekle
   */
  addInteractivity() {
    let isPanning = false;
    let startX, startY;
    let currentTransform = { x: 0, y: 0, scale: 1 };

    this.svg.addEventListener('mousedown', (e) => {
      if (e.target === this.svg || e.target.closest('.columns')) {
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

    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      currentTransform.scale = Math.min(Math.max(currentTransform.scale * delta, 0.3), 3);
      this.updateTransform(currentTransform);
    });
  }

  updateTransform(transform) {
    this.mainGroup.setAttribute(
      'transform',
      `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`
    );
  }
}

export default BranchMapRenderer;
