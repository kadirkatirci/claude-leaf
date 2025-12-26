/**
 * BranchMapRenderer - Branch map'i SVG olarak renderlar
 *
 * Kurallar:
 * - Aynı mesaj numarası = Aynı yatay hiza (satır)
 * - Sütun sırası: Sol dallar → Ana yol → Sağ dallar
 * - Duplicate node'lar filtrelenmiş durumda
 * - Aynı satırda başlayan sütunlar yan yana gruplanır
 * - Bağlantılar: Her snapshot'taki ardışık node'ları bağla + sütun içi dikey bağlantılar
 *
 * Render sırası (z-index):
 * 1. Columns (en altta)
 * 2. Connections (ortada)
 * 3. Nodes (en üstte)
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
      ...options,
    };

    this.svg = null;
    this.mainGroup = null;
    this.colorMap = new Map();
    this.rowPositions = new Map();
    this.columnLayouts = [];
    this.startNodePos = null;
    this.nodePositionMap = new Map();
    this.tooltip = null;

    // Theme detection - use Claude's data-mode attribute
    this.isDarkMode = this.detectClaudeTheme();
    this.theme = this.getThemeColors();
  }

  /**
   * Detect Claude's active theme from data-mode attribute
   * @returns {boolean} True if dark mode, false if light mode
   */
  detectClaudeTheme() {
    const htmlElement = document.documentElement;
    const dataMode = htmlElement.getAttribute('data-mode');
    return dataMode === 'dark';
  }

  /**
   * Get theme colors based on dark/light mode
   */
  getThemeColors() {
    if (this.isDarkMode) {
      return {
        bgPrimary: '#1a1a1a',
        bgSecondary: '#2a2a2a',
        bgTertiary: '#3a3a3a',
        textPrimary: '#e5e5e5',
        textSecondary: '#a3a3a3',
        textTertiary: '#737373',
        border: '#404040',
        connection: '#6b7280',
        tooltipBg: '#2a2a2a',
        tooltipBorder: '#4a4a4a',
      };
    } else {
      return {
        bgPrimary: '#ffffff',
        bgSecondary: '#f5f5f5',
        bgTertiary: '#e5e5e5',
        textPrimary: '#171717',
        textSecondary: '#525252',
        textTertiary: '#737373',
        border: '#d4d4d4',
        connection: '#9ca3af',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e5e5e5',
      };
    }
  }

  render() {
    console.log('[BranchMapRenderer] Starting render with data:', this.data);

    if (!this.data.columns || this.data.columns.length === 0) {
      const noDataDiv = document.createElement('div');
      noDataDiv.style.padding = '2rem';
      noDataDiv.style.textAlign = 'center';
      noDataDiv.style.color = this.theme.textTertiary;
      noDataDiv.textContent = 'No data to display';
      this.container.innerHTML = '';
      this.container.appendChild(noDataDiv);
      return;
    }

    this.buildColorMap();
    this.calculateRowPositions();
    this.calculateColumnLayoutsGroupedByRow();

    const bounds = this.calculateBounds();
    this.createSVG(bounds.width, bounds.height);
    this.createTooltip();

    // Render sırası önemli! (z-index)
    // 1. Columns (arka plan)
    // 2. Connections (çizgiler - columns üstünde, nodes altında)
    // 3. Start node & Nodes (en üstte)
    this.renderColumns();
    this.renderConnections();
    this.renderStartNode();
    this.renderNodes();
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

  /**
   * Sütunları satıra göre grupla ve pozisyonla
   * Aynı satırda başlayan sütunlar yan yana
   */
  calculateColumnLayoutsGroupedByRow() {
    const { startX, nodeWidth, horizontalGap, columnPadding, nodeHeight } = this.options;

    // Her satır için o satırda kullanılan maksimum X pozisyonunu takip et
    const rowMaxX = new Map();
    this.data.messageIndices.forEach(msgIndex => {
      rowMaxX.set(msgIndex, startX + nodeWidth + horizontalGap);
    });

    this.data.columns.forEach(column => {
      if (!column.nodes || column.nodes.length === 0) {
        return;
      }

      // Bu sütunun başladığı satır (ilk node'un satırı)
      const firstNodeRow = column.nodes[0].messageIndex;

      // Bu sütunun kapsadığı tüm satırlar
      const coveredRows = column.nodes.map(n => n.messageIndex);

      // Bu sütun için X pozisyonunu belirle:
      // Kapsadığı tüm satırlardaki maksimum X'in en büyüğü
      let columnX = 0;
      coveredRows.forEach(row => {
        const currentMaxX = rowMaxX.get(row) || startX + nodeWidth + horizontalGap;
        columnX = Math.max(columnX, currentMaxX);
      });

      // Node pozisyonlarını hesapla
      const nodePositions = column.nodes.map(node => {
        const pos = {
          ...node,
          x: columnX + columnPadding,
          y: this.rowPositions.get(node.messageIndex),
        };

        const nodeKey = node.uniqueId;
        this.nodePositionMap.set(nodeKey, {
          x: pos.x,
          y: pos.y,
          columnId: column.id,
        });

        return pos;
      });

      // Sütun boyutlarını hesapla
      const ys = nodePositions.map(n => n.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const colWidth = nodeWidth + columnPadding * 2;

      const layout = {
        id: column.id,
        type: column.type,
        connectFrom: column.connectFrom,
        x: columnX,
        y: minY - columnPadding,
        width: colWidth,
        height: maxY - minY + nodeHeight + columnPadding * 2,
        nodes: nodePositions,
      };

      this.columnLayouts.push(layout);

      // Bu sütunun kapladığı tüm satırlar için maxX'i güncelle
      coveredRows.forEach(row => {
        rowMaxX.set(row, columnX + colWidth + horizontalGap);
      });
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
    this.svg.style.background = this.theme.bgPrimary;
    this.svg.style.minWidth = `${width}px`;
    this.svg.style.minHeight = `${height}px`;

    this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mainGroup.setAttribute('class', 'main-group');
    this.svg.appendChild(this.mainGroup);
    this.container.appendChild(this.svg);
  }

  /**
   * Custom tooltip oluştur
   */
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'branch-map-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      z-index: 10010;
      max-width: 400px;
      max-height: 300px;
      padding: 12px 14px;
      border-radius: 10px;
      background: ${this.theme.tooltipBg};
      border: 1px solid ${this.theme.tooltipBorder};
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    this.container.appendChild(this.tooltip);
  }

  /**
   * Tooltip'i göster
   */
  showTooltip(node, event) {
    const color = this.colorMap.get(node.containerId) || '#6366f1';
    const content = node.content || node.contentPreview || 'No content available';

    this.tooltip.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid ${this.theme.border};
        flex-shrink: 0;
      ">
        <div style="
          width: 12px;
          height: 12px;
          border-radius: 3px;
          background: ${color};
          flex-shrink: 0;
        "></div>
        <span style="
          font-weight: 600;
          font-size: 13px;
          color: ${this.theme.textPrimary};
        ">Message #${node.messageIndex}</span>
        <span style="
          font-size: 12px;
          color: ${this.theme.textTertiary};
          margin-left: auto;
        ">${node.version}</span>
      </div>
      <div style="
        font-size: 13px;
        line-height: 1.5;
        color: ${this.theme.textSecondary};
        overflow-y: auto;
        flex: 1;
        white-space: pre-wrap;
        word-break: break-word;
      ">${this.escapeHtml(content)}</div>
    `;

    // Pozisyonu hesapla
    this.positionTooltip(event);
    this.tooltip.style.opacity = '1';
  }

  /**
   * Tooltip pozisyonunu ayarla (ekran kenarlarına taşmaz)
   */
  positionTooltip(event) {
    const padding = 15;
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = event.clientX + padding;
    let y = event.clientY + padding;

    // Sağ kenara taşarsa sola al
    if (x + tooltipRect.width > viewportWidth - padding) {
      x = event.clientX - tooltipRect.width - padding;
    }

    // Alt kenara taşarsa yukarı al
    if (y + tooltipRect.height > viewportHeight - padding) {
      y = event.clientY - tooltipRect.height - padding;
    }

    // Sol kenara taşarsa düzelt
    if (x < padding) {
      x = padding;
    }

    // Üst kenara taşarsa düzelt
    if (y < padding) {
      y = padding;
    }

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  /**
   * Tooltip'i gizle
   */
  hideTooltip() {
    this.tooltip.style.opacity = '0';
  }

  /**
   * HTML escape
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    rect.setAttribute('fill', this.theme.bgTertiary);
    rect.setAttribute('stroke', this.theme.border);
    rect.setAttribute('stroke-width', '1');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', nodeWidth / 2);
    text.setAttribute('y', nodeHeight / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', this.theme.textSecondary);
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
      // Yalnızca 1'den fazla node varsa container oluştur
      if (col.nodes.length <= 1) {
        return;
      }

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', col.x);
      rect.setAttribute('y', col.y);
      rect.setAttribute('width', col.width);
      rect.setAttribute('height', col.height);
      rect.setAttribute('rx', '12');
      rect.setAttribute('fill', this.theme.bgSecondary);
      rect.setAttribute('stroke', this.theme.border);
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
    g.style.cursor = 'default';

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

    g.appendChild(rect);
    g.appendChild(text);

    // Hover efektleri ve tooltip
    g.addEventListener('mouseenter', e => {
      rect.style.filter = 'brightness(1.15)';
      this.showTooltip(node, e);
    });

    g.addEventListener('mousemove', e => {
      this.positionTooltip(e);
    });

    g.addEventListener('mouseleave', () => {
      rect.style.filter = '';
      this.hideTooltip();
    });

    return g;
  }

  /**
   * Bağlantıları çiz - Snapshot bazlı + Sütun içi
   * 1. Her snapshot'taki ardışık node'ları bağla
   * 2. Aynı sütundaki ardışık node'ları bağla
   */
  renderConnections() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'connections');

    const { nodeWidth, nodeHeight } = this.options;

    // START node pozisyonunu hesapla (henüz renderStartNode çağrılmadı)
    const firstRowY = this.rowPositions.get(this.data.messageIndices[0]) || this.options.startY;
    this.startNodePos = {
      x: this.options.startX,
      y: firstRowY,
      width: nodeWidth,
      height: nodeHeight,
    };

    // Duplicate bağlantıları önlemek için Set kullan
    const drawnConnections = new Set();

    // 1. Her snapshot (path) için bağlantıları çiz
    if (this.data.paths && this.data.paths.length > 0) {
      this.data.paths.forEach(path => {
        const messages = path.messages;

        // İlk node'u START'a bağla
        if (messages.length > 0) {
          const firstMsg = messages[0];
          const firstNodeKey = firstMsg.uniqueId;
          const firstNodePos = this.nodePositionMap.get(firstNodeKey);

          if (firstNodePos) {
            const connectionKey = `START->${firstNodeKey}`;
            if (!drawnConnections.has(connectionKey)) {
              g.appendChild(
                this.createConnection(
                  this.startNodePos.x + this.startNodePos.width,
                  this.startNodePos.y + this.startNodePos.height / 2,
                  firstNodePos.x,
                  firstNodePos.y + nodeHeight / 2
                )
              );
              drawnConnections.add(connectionKey);
            }
          }
        }

        // Ardışık node'ları bağla
        for (let i = 0; i < messages.length - 1; i++) {
          const currentMsg = messages[i];
          const nextMsg = messages[i + 1];

          const currentKey = currentMsg.uniqueId;
          const nextKey = nextMsg.uniqueId;

          const currentPos = this.nodePositionMap.get(currentKey);
          const nextPos = this.nodePositionMap.get(nextKey);

          if (currentPos && nextPos) {
            const connectionKey = `${currentKey}->${nextKey}`;
            if (!drawnConnections.has(connectionKey)) {
              g.appendChild(
                this.createConnection(
                  currentPos.x + nodeWidth,
                  currentPos.y + nodeHeight / 2,
                  nextPos.x,
                  nextPos.y + nodeHeight / 2
                )
              );
              drawnConnections.add(connectionKey);
            }
          }
        }
      });
    }

    // 2. Aynı sütundaki ardışık node'ları bağla (dikey bağlantılar)
    this.columnLayouts.forEach(col => {
      if (col.nodes.length <= 1) {
        return;
      }

      // Node'ları messageIndex'e göre sırala
      const sortedNodes = [...col.nodes].sort((a, b) => a.messageIndex - b.messageIndex);

      for (let i = 0; i < sortedNodes.length - 1; i++) {
        const currentNode = sortedNodes[i];
        const nextNode = sortedNodes[i + 1];

        const currentKey = currentNode.uniqueId;
        const nextKey = nextNode.uniqueId;
        const connectionKey = `${currentKey}->${nextKey}`;

        // Henüz çizilmemişse çiz
        if (!drawnConnections.has(connectionKey)) {
          // Dikey bağlantı: alt kenardan üst kenara
          g.appendChild(
            this.createVerticalConnection(
              currentNode.x + nodeWidth / 2,
              currentNode.y + nodeHeight,
              nextNode.x + nodeWidth / 2,
              nextNode.y
            )
          );
          drawnConnections.add(connectionKey);
        }
      }
    });

    this.mainGroup.appendChild(g);
  }

  /**
   * Yatay bağlantı çiz (farklı sütunlar arası)
   */
  createConnection(x1, y1, x2, y2) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', this.theme.connection);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-opacity', '0.8');

    return path;
  }

  /**
   * Dikey bağlantı çiz (aynı sütundaki node'lar için)
   */
  createVerticalConnection(x1, y1, x2, y2) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midY = (y1 + y2) / 2;
    const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', this.theme.connection);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-opacity', '0.8');

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
      text.setAttribute('fill', this.theme.textTertiary);
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
    const transform = { x: 0, y: 0, scale: 1 };

    this.svg.addEventListener('mousedown', e => {
      if (e.target === this.svg || e.target.closest('.columns')) {
        isPanning = true;
        startX = e.clientX - transform.x;
        startY = e.clientY - transform.y;
        this.svg.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', e => {
      if (!isPanning) {
        return;
      }
      transform.x = e.clientX - startX;
      transform.y = e.clientY - startY;
      this.mainGroup.setAttribute(
        'transform',
        `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`
      );
    });

    document.addEventListener('mouseup', () => {
      isPanning = false;
      this.svg.style.cursor = 'default';
    });

    // Note: passive:false is intentional - we need preventDefault() to block page scroll during SVG zoom
    this.svg.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        transform.scale = Math.min(Math.max(transform.scale * delta, 0.3), 3);
        this.mainGroup.setAttribute(
          'transform',
          `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`
        );
      },
      { passive: false }
    );
  }
}

export default BranchMapRenderer;
