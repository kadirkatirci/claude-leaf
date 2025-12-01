/**
 * TreeBuilder - Converts conversation snapshots into a D3-compatible tree
 * 
 * REVISED Algorithm (Snapshot-Based Layered Graph):
 * Each snapshot represents a "state" of the conversation.
 * We don't try to infer parent-child from timestamps.
 * Instead, we show snapshots as layers, with nodes grouped by snapshot.
 */

export class TreeBuilder {
    constructor(snapshots) {
        this.snapshots = snapshots.sort((a, b) => a.timestamp - b.timestamp);
        this.nodes = new Map(); // Key: "containerId:version", Value: Node object
        this.layers = []; // Array of layers, each layer is an array of nodes
    }

    /**
     * Build the layered structure
     * @returns {Object} Data for custom rendering (not D3 hierarchy)
     */
    build() {
        console.log('[TreeBuilder] Starting build with', this.snapshots.length, 'snapshots');

        try {
            // Step 1: Extract all unique nodes
            this.extractNodes();
            console.log('[TreeBuilder] Nodes extracted:', this.nodes.size);

            // Step 2: Group nodes by snapshot (layers)
            this.buildLayers();
            console.log('[TreeBuilder] Layers built:', this.layers.length);

            return {
                layers: this.layers,
                allNodes: Array.from(this.nodes.values())
            };
        } catch (error) {
            console.error('[TreeBuilder] Build error:', error);
            throw error;
        }
    }

    /**
     * Extract all unique message versions from snapshots
     */
    extractNodes() {
        this.snapshots.forEach((snapshot, snapshotIndex) => {
            snapshot.messages.forEach(msg => {
                if (!msg.version) return;

                const cleanVersion = msg.version.replace(/\s+/g, '');
                const nodeId = `${msg.containerId}:${cleanVersion}`;

                if (!this.nodes.has(nodeId)) {
                    // Extract message index from containerId (e.g., "edit-index-14" -> 14)
                    const msgIndex = parseInt(msg.containerId.split('-')[2] || 0);

                    this.nodes.set(nodeId, {
                        id: nodeId,
                        containerId: msg.containerId,
                        messageIndex: msgIndex,
                        version: msg.version,
                        contentPreview: msg.contentPreview,
                        isGhost: false,
                        snapshotIndex, // Which snapshot first introduced this node
                        layer: -1 // Will be set in buildLayers
                    });
                }
            });
        });

        console.log(`[TreeBuilder] Extracted ${this.nodes.size} unique nodes`);
    }

    /**
     * Build layers: each snapshot becomes a layer
     * Nodes in the same snapshot are shown horizontally
     */
    buildLayers() {
        this.snapshots.forEach((snapshot, layerIndex) => {
            const layerNodes = [];

            snapshot.messages
                .filter(m => m.version)
                .forEach(msg => {
                    const cleanVersion = msg.version.replace(/\s+/g, '');
                    const nodeId = `${msg.containerId}:${cleanVersion}`;
                    const node = this.nodes.get(nodeId);

                    if (node) {
                        node.layer = layerIndex;
                        layerNodes.push(node);
                    }
                });

            // Sort nodes in layer by message index
            layerNodes.sort((a, b) => a.messageIndex - b.messageIndex);

            this.layers.push({
                index: layerIndex,
                timestamp: snapshot.timestamp,
                nodes: layerNodes
            });

            console.log(`[TreeBuilder] Layer ${layerIndex}: ${layerNodes.length} nodes`);
        });
    }
}

export default TreeBuilder;
