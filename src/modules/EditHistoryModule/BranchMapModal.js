import DOMUtils from '../../utils/DOMUtils.js';
import { editHistoryStore } from '../../stores/index.js';
import TreeBuilder from './TreeBuilder.js';
import * as d3 from 'd3';

class BranchMapModal {
    constructor() {
        this.overlay = null;
        this.modal = null;
        this.isVisible = false;
    }

    async show(conversationUrl) {
        if (this.isVisible) return;

        // Fetch all snapshots for this conversation
        const snapshots = await editHistoryStore.getSnapshots(conversationUrl);

        if (!snapshots || snapshots.length === 0) {
            alert('No snapshots found. Please navigate through the conversation to capture snapshots.');
            return;
        }

        console.log(`[BranchMapModal] Loaded ${snapshots.length} snapshots`);

        this.createModal(snapshots);
        this.isVisible = true;
        document.body.style.overflow = 'hidden';
    }

    hide() {
        if (!this.isVisible) return;

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }

        this.isVisible = false;
        document.body.style.overflow = '';
    }

    createModal(snapshots) {
        // Overlay
        this.overlay = DOMUtils.createElement('div');
        this.overlay.className = 'fixed inset-0 bg-black/50 z-[10001] flex items-center justify-center p-8 backdrop-blur-sm';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Modal Container
        this.modal = DOMUtils.createElement('div');
        this.modal.className = 'bg-bg-000 rounded-xl shadow-2xl w-[90vw] max-w-[1200px] h-[80vh] flex flex-col border border-border-200 overflow-hidden';

        // Header
        const header = DOMUtils.createElement('div');
        header.className = 'p-4 border-b border-border-200 flex justify-between items-center bg-bg-100';

        const title = DOMUtils.createElement('h2');
        title.className = 'text-lg font-semibold text-text-100 flex items-center gap-2';
        title.innerHTML = `🗺️ Chat Branch Map <span class="text-xs font-normal text-text-300 bg-bg-200 px-2 py-0.5 rounded-full">${snapshots.length} snapshots</span>`;

        const closeBtn = DOMUtils.createElement('button');
        closeBtn.className = 'p-2 hover:bg-bg-200 rounded-lg transition-colors text-text-300 hover:text-text-100';
        closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        closeBtn.addEventListener('click', () => this.hide());

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Content Area (SVG Container)
        const content = DOMUtils.createElement('div');
        content.className = 'flex-1 overflow-hidden bg-bg-000 relative';
        content.id = 'branch-map-content';

        this.modal.appendChild(header);
        this.modal.appendChild(content);
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        // Render the tree AFTER the modal is in the DOM
        // This ensures container has proper dimensions
        requestAnimationFrame(() => {
            try {
                this.renderD3Tree(content, snapshots);
            } catch (error) {
                console.error('[BranchMapModal] Render error:', error);
                content.innerHTML = `<div class="p-8 text-center text-text-300">
                    <p>Failed to render tree</p>
                    <p class="text-xs mt-2">${error.message}</p>
                </div>`;
            }
        });
    }

    renderD3Tree(container, snapshots) {
        // Build layers from snapshots
        const builder = new TreeBuilder(snapshots);
        const data = builder.build();

        console.log('[BranchMapModal] Layers:', data.layers.length);

        // Set up SVG dimensions
        const modalHeight = this.modal.clientHeight || 800;
        const modalWidth = this.modal.clientWidth || 1200;

        const width = Math.max(modalWidth * 0.9, 800);
        const height = Math.max(modalHeight * 0.7, 500);

        console.log('[BranchMapModal] SVG dimensions:', width, 'x', height);

        if (width < 100 || height < 100) {
            console.error('[BranchMapModal] Invalid dimensions, container not ready');
            return;
        }

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'var(--bg-000)');

        console.log('[BranchMapModal] SVG created');

        // Create a group for zoom/pan
        const g = svg.append('g');

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Calculate layout
        const layerHeight = height / (data.layers.length + 1);
        const nodeSpacing = 80;

        // Draw layers
        data.layers.forEach((layer, layerIndex) => {
            const y = (layerIndex + 1) * layerHeight;
            const totalWidth = layer.nodes.length * nodeSpacing;
            const startX = (width - totalWidth) / 2;

            // Draw layer label
            g.append('text')
                .attr('x', 20)
                .attr('y', y)
                .attr('fill', 'var(--text-300)')
                .attr('font-size', '10px')
                .text(`Snapshot ${layerIndex + 1}`);

            // Draw nodes in this layer
            layer.nodes.forEach((node, nodeIndex) => {
                const x = startX + (nodeIndex + 0.5) * nodeSpacing;

                // Node group
                const nodeGroup = g.append('g')
                    .attr('class', 'node')
                    .attr('transform', `translate(${x},${y})`)
                    .style('cursor', 'pointer');

                // Node circle
                const colors = ['#60a5fa', '#4ade80', '#c084fc', '#fb923c', '#f472b6', '#22d3ee'];
                const color = colors[node.messageIndex % colors.length];

                nodeGroup.append('circle')
                    .attr('r', 12)
                    .attr('fill', color)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 2);

                // Node label
                nodeGroup.append('text')
                    .attr('dy', -20)
                    .attr('text-anchor', 'middle')
                    .attr('fill', 'var(--text-100)')
                    .attr('font-size', '11px')
                    .attr('font-weight', 'bold')
                    .text(node.version);

                // Content preview on hover
                nodeGroup.append('title')
                    .text(node.contentPreview || 'No preview');

                // Click to navigate
                nodeGroup.on('click', () => {
                    this.scrollToMessage(node.containerId);
                    this.hide();
                });

                // Store position for edge drawing
                node.x = x;
                node.y = y;
            });
        });

        // Draw edges between layers
        for (let i = 0; i < data.layers.length - 1; i++) {
            const currentLayer = data.layers[i];
            const nextLayer = data.layers[i + 1];

            // For each node in current layer, find matching nodes in next layer
            currentLayer.nodes.forEach(currentNode => {
                nextLayer.nodes.forEach(nextNode => {
                    // Draw edge if same message (different version) or sequential messages
                    const shouldConnect =
                        currentNode.containerId === nextNode.containerId || // Same message, different version
                        currentNode.messageIndex < nextNode.messageIndex; // Sequential

                    if (shouldConnect) {
                        g.append('line')
                            .attr('x1', currentNode.x)
                            .attr('y1', currentNode.y)
                            .attr('x2', nextNode.x)
                            .attr('y2', nextNode.y)
                            .attr('stroke', 'var(--border-300)')
                            .attr('stroke-width', 1.5)
                            .attr('stroke-opacity', 0.4)
                            .lower(); // Send to back
                    }
                });
            });
        }

        // Center the view
        const initialTransform = d3.zoomIdentity
            .translate(50, 0)
            .scale(1);
        svg.call(zoom.transform, initialTransform);
    }

    scrollToMessage(containerId) {
        if (containerId.startsWith('edit-index-')) {
            const index = parseInt(containerId.replace('edit-index-', ''));
            const userMessages = document.querySelectorAll('[data-testid="user-message"]');
            if (userMessages[index]) {
                userMessages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Highlight effect
                const el = userMessages[index].closest('.font-user-message') || userMessages[index];
                el.style.transition = 'background-color 0.5s';
                el.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                setTimeout(() => {
                    el.style.backgroundColor = '';
                }, 2000);
                return;
            }
        }

        console.warn('Could not find message element for', containerId);
    }
}

export default BranchMapModal;
