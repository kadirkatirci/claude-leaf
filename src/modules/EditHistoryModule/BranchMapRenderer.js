import { debugLog } from '../../config/debug.js';

/**
 * BranchMapRenderer - Renders branch map as SVG
 *
 * Rules:
 * - Same message number = Same horizontal alignment (row)
 * - Column order: Left branches → Main path → Right branches
 * - Duplicate nodes are filtered
 * - Columns starting on the same row are grouped side by side
 * - Connections: Connect consecutive nodes in each snapshot + vertical connections within columns
 *
 * Render order (z-index):
 * 1. Columns (bottom layer)
 * 2. Connections (middle layer)
 * 3. Nodes (top layer)
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
        '#ef4444', // red
        '#f97316', // orange
        '#eab308', // yellow
        '#22c55e', // green
        '#06b6d4', // cyan
        '#3b82f6', // blue
        '#8b5cf6', // purple
        '#ec4899', // pink
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

  getElementStyles(section, overrides = {}) {
    const styles = {
      noData: {
        padding: '2rem',
        textAlign: 'center',
        color: this.theme.textTertiary,
      },
      svg: {
        background: this.theme.bgPrimary,
      },
      tooltip: {
        position: 'fixed',
        zIndex: '10010',
        maxWidth: '400px',
        maxHeight: '300px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: this.theme.tooltipBg,
        border: `1px solid ${this.theme.tooltipBorder}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.15s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
      tooltipHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingBottom: '8px',
        borderBottom: `1px solid ${this.theme.border}`,
        flexShrink: '0',
      },
      tooltipSwatch: {
        width: '12px',
        height: '12px',
        borderRadius: '3px',
        flexShrink: '0',
      },
      tooltipTitle: {
        fontWeight: '600',
        fontSize: '13px',
        color: this.theme.textPrimary,
      },
      tooltipVersion: {
        fontSize: '12px',
        color: this.theme.textTertiary,
        marginLeft: 'auto',
      },
      tooltipBody: {
        fontSize: '13px',
        lineHeight: '1.5',
        color: this.theme.textSecondary,
        overflowY: 'auto',
        flex: '1',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      },
    };

    return {
      ...(styles[section] || {}),
      ...overrides,
    };
  }

  createNoDataState() {
    const noDataDiv = document.createElement('div');
    Object.assign(noDataDiv.style, this.getElementStyles('noData'));
    noDataDiv.textContent = 'No data to display';
    return noDataDiv;
  }

  createTooltipHeader(node, color) {
    const header = document.createElement('div');
    Object.assign(header.style, this.getElementStyles('tooltipHeader'));

    const swatch = document.createElement('div');
    Object.assign(
      swatch.style,
      this.getElementStyles('tooltipSwatch', {
        background: color,
      })
    );

    const title = document.createElement('span');
    Object.assign(title.style, this.getElementStyles('tooltipTitle'));
    title.textContent = `Message #${node.messageIndex}`;

    const version = document.createElement('span');
    Object.assign(version.style, this.getElementStyles('tooltipVersion'));
    version.textContent = node.version;

    header.appendChild(swatch);
    header.appendChild(title);
    header.appendChild(version);

    return header;
  }

  createTooltipBody(content) {
    const body = document.createElement('div');
    Object.assign(body.style, this.getElementStyles('tooltipBody'));
    body.textContent = content;
    return body;
  }

  createTooltipContent(node) {
    const color = this.colorMap.get(node.containerId) || '#6366f1';
    const content = node.content || node.contentPreview || 'No content available';
    const fragment = document.createDocumentFragment();

    fragment.appendChild(this.createTooltipHeader(node, color));
    fragment.appendChild(this.createTooltipBody(content));

    return fragment;
  }

  setTooltipVisibility(visible) {
    if (!this.tooltip) {
      return;
    }
    this.tooltip.style.opacity = visible ? '1' : '0';
  }

  setTooltipCoordinates(x, y) {
    if (!this.tooltip) {
      return;
    }
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  setSvgCursor(cursor) {
    if (!this.svg) {
      return;
    }
    this.svg.style.cursor = cursor;
  }

  setNodeCursor(nodeGroup, cursor = 'default') {
    if (!nodeGroup) {
      return;
    }
    nodeGroup.style.cursor = cursor;
  }

  setNodeHoverState(nodeRect, hovered) {
    if (!nodeRect) {
      return;
    }
    nodeRect.style.filter = hovered ? 'brightness(1.15)' : '';
  }

  render() {
    debugLog('editHistory', 'BranchMapRenderer starting render with data:', this.data);

    if (!this.data.columns || this.data.columns.length === 0) {
      this.container.innerHTML = '';
      this.container.appendChild(this.createNoDataState());
      return;
    }

    this.buildColorMap();
    this.calculateRowPositions();
    this.calculateColumnLayoutsGroupedByRow();

    const bounds = this.calculateBounds();
    this.createSVG(bounds.width, bounds.height);
    this.createTooltip();

    // Render order is important! (z-index)
    // 1. Columns (background)
    // 2. Connections (lines - above columns, below nodes)
    // 3. Start node & Nodes (on top)
    this.renderColumns();
    this.renderConnections();
    this.renderStartNode();
    this.renderNodes();
    this.renderLegend(bounds.height);
    this.addInteractivity();

    debugLog('editHistory', 'BranchMapRenderer render complete');
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
   * Group and position columns by row
   * Columns starting on the same row are placed side by side
   */
  calculateColumnLayoutsGroupedByRow() {
    const { startX, nodeWidth, horizontalGap, columnPadding, nodeHeight } = this.options;

    // Track the maximum X position used in each row
    const rowMaxX = new Map();
    this.data.messageIndices.forEach(msgIndex => {
      rowMaxX.set(msgIndex, startX + nodeWidth + horizontalGap);
    });

    this.data.columns.forEach(column => {
      if (!column.nodes || column.nodes.length === 0) {
        return;
      }

      // All rows covered by this column
      const coveredRows = column.nodes.map(n => n.messageIndex);

      // Determine X position for this column:
      // The largest of the maximum X values in all covered rows
      let columnX = 0;
      coveredRows.forEach(row => {
        const currentMaxX = rowMaxX.get(row) || startX + nodeWidth + horizontalGap;
        columnX = Math.max(columnX, currentMaxX);
      });

      // Calculate node positions
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

      // Calculate column dimensions
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

      // Update maxX for all rows covered by this column
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
    this.svg.id = 'claude-branch-map-svg';
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    Object.assign(this.svg.style, this.getElementStyles('svg'));
    this.setSvgCursor('default');
    this.svg.style.minWidth = `${width}px`;
    this.svg.style.minHeight = `${height}px`;

    this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mainGroup.id = 'claude-branch-map-main-group';
    this.mainGroup.setAttribute('class', 'main-group');
    this.svg.appendChild(this.mainGroup);
    this.container.appendChild(this.svg);
  }

  /**
   * Create custom tooltip
   */
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'claude-branch-map-tooltip';
    this.tooltip.className = 'branch-map-tooltip';
    Object.assign(this.tooltip.style, this.getElementStyles('tooltip'));

    this.container.appendChild(this.tooltip);
  }

  /**
   * Show tooltip
   */
  showTooltip(node, event) {
    this.tooltip.replaceChildren(this.createTooltipContent(node));

    // Calculate position
    this.positionTooltip(event);
    this.setTooltipVisibility(true);
  }

  /**
   * Set tooltip position (prevents overflow from screen edges)
   */
  positionTooltip(event) {
    const padding = 15;
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = event.clientX + padding;
    let y = event.clientY + padding;

    // Move to left if overflows right edge
    if (x + tooltipRect.width > viewportWidth - padding) {
      x = event.clientX - tooltipRect.width - padding;
    }

    // Move up if overflows bottom edge
    if (y + tooltipRect.height > viewportHeight - padding) {
      y = event.clientY - tooltipRect.height - padding;
    }

    // Fix if overflows left edge
    if (x < padding) {
      x = padding;
    }

    // Fix if overflows top edge
    if (y < padding) {
      y = padding;
    }

    this.setTooltipCoordinates(x, y);
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    this.setTooltipVisibility(false);
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
      // Only create container if more than 1 node
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
    g.setAttribute('data-branch-node-id', node.uniqueId);
    g.setAttribute('data-branch-node-version', node.version);
    g.setAttribute('data-branch-node-message-index', String(node.messageIndex));
    this.setNodeCursor(g);

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

    // Hover effects and tooltip
    g.addEventListener('mouseenter', e => {
      this.setNodeHoverState(rect, true);
      this.showTooltip(node, e);
    });

    g.addEventListener('mousemove', e => {
      this.positionTooltip(e);
    });

    g.addEventListener('mouseleave', () => {
      this.setNodeHoverState(rect, false);
      this.hideTooltip();
    });

    return g;
  }

  /**
   * Draw connections - Snapshot based + Within column
   * 1. Connect consecutive nodes in each snapshot
   * 2. Connect consecutive nodes in the same column
   */
  renderConnections() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'connections');

    const { nodeWidth, nodeHeight } = this.options;

    // Calculate START node position (renderStartNode not yet called)
    const firstRowY = this.rowPositions.get(this.data.messageIndices[0]) || this.options.startY;
    this.startNodePos = {
      x: this.options.startX,
      y: firstRowY,
      width: nodeWidth,
      height: nodeHeight,
    };

    // Use Set to prevent duplicate connections
    const drawnConnections = new Set();

    // 1. Draw connections for each snapshot (path)
    if (this.data.paths && this.data.paths.length > 0) {
      this.data.paths.forEach(path => {
        const messages = path.messages;

        // Connect first node to START
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

        // Connect consecutive nodes
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

    // 2. Connect consecutive nodes in the same column (vertical connections)
    this.columnLayouts.forEach(col => {
      if (col.nodes.length <= 1) {
        return;
      }

      // Sort nodes by messageIndex
      const sortedNodes = [...col.nodes].sort((a, b) => a.messageIndex - b.messageIndex);

      for (let i = 0; i < sortedNodes.length - 1; i++) {
        const currentNode = sortedNodes[i];
        const nextNode = sortedNodes[i + 1];

        const currentKey = currentNode.uniqueId;
        const nextKey = nextNode.uniqueId;
        const connectionKey = `${currentKey}->${nextKey}`;

        // Draw if not already drawn
        if (!drawnConnections.has(connectionKey)) {
          // Vertical connection: from bottom edge to top edge
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
   * Draw horizontal connection (between different columns)
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
   * Draw vertical connection (for nodes in the same column)
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
        this.setSvgCursor('grabbing');
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
      this.setSvgCursor('default');
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
