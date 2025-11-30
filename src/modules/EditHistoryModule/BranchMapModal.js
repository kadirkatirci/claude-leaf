import DOMUtils from '../../utils/DOMUtils.js';
import { editHistoryStore } from '../../stores/index.js';

class BranchMapModal {
    constructor() {
        this.overlay = null;
        this.modal = null;
        this.isVisible = false;
    }

    async show(conversationUrl) {
        if (this.isVisible) return;

        // Fetch all history for this conversation
        const history = await editHistoryStore.getByConversation(conversationUrl);

        if (!history || history.length === 0) {
            alert('No edit history found for this conversation.');
            return;
        }

        this.createModal(history);
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

    createModal(history) {
        // Overlay
        this.overlay = DOMUtils.createElement('div');
        this.overlay.className = 'fixed inset-0 bg-black/50 z-[10001] flex items-center justify-center p-8 backdrop-blur-sm';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Modal Container
        this.modal = DOMUtils.createElement('div');
        this.modal.className = 'bg-bg-000 rounded-xl shadow-2xl w-[800px] max-w-[90vw] h-[600px] max-h-[80vh] flex flex-col border border-border-200 overflow-hidden';

        // Header
        const header = DOMUtils.createElement('div');
        header.className = 'p-4 border-b border-border-200 flex justify-between items-center bg-bg-100';

        const title = DOMUtils.createElement('h2');
        title.className = 'text-lg font-semibold text-text-100 flex items-center gap-2';
        title.innerHTML = '🗺️ Chat Branch Map <span class="text-xs font-normal text-text-300 bg-bg-200 px-2 py-0.5 rounded-full">' + history.length + ' edits</span>';

        const closeBtn = DOMUtils.createElement('button');
        closeBtn.className = 'p-2 hover:bg-bg-200 rounded-lg transition-colors text-text-300 hover:text-text-100';
        closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        closeBtn.addEventListener('click', () => this.hide());

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Content Area (Scrollable)
        const content = DOMUtils.createElement('div');
        content.className = 'flex-1 overflow-auto p-8 bg-bg-000 relative';

        // Render the tree/timeline
        this.renderTimeline(content, history);

        this.modal.appendChild(header);
        this.modal.appendChild(content);
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
    }

    renderTimeline(container, history) {
        // 1. Group by message index (using containerId 'edit-index-N')
        const messageGroups = new Map(); // Index -> Array of versions

        history.forEach(item => {
            let index = -1;
            if (item.containerId.startsWith('edit-index-')) {
                index = parseInt(item.containerId.replace('edit-index-', ''));
            } else {
                // Fallback for legacy IDs or unknown format
                // We'll group them under a special index
                index = 9999;
            }

            if (!messageGroups.has(index)) {
                messageGroups.set(index, []);
            }
            messageGroups.get(index).push(item);
        });

        // 2. Sort groups by index
        const sortedIndices = Array.from(messageGroups.keys()).sort((a, b) => a - b);

        // 3. Build the tree structure
        // We want to visualize a "Conversation Tree".
        // Root -> Msg 0 v1 -> Msg 2 v1
        //                  -> Msg 2 v2
        //       -> Msg 0 v2 -> (No children yet)

        // Since we don't have explicit parent links, we infer them by timestamp.
        // A version V of Msg N is a child of the version of Msg N-1 that was "active" at V.timestamp.

        const treeRoot = { id: 'root', children: [], version: null };

        // Helper to find active version of a message at a given time
        const findActiveVersion = (msgIndex, timestamp) => {
            if (msgIndex < 0) return treeRoot;
            const versions = messageGroups.get(msgIndex);
            if (!versions) return null; // Should not happen if logic is correct

            // Find version with max timestamp < given timestamp
            let active = null;
            for (const v of versions) {
                if (v.timestamp < timestamp) {
                    if (!active || v.timestamp > active.timestamp) {
                        active = v;
                    }
                }
            }
            return active;
        };

        // We need to process messages in order.
        // But actually, we need to process *versions* in order of creation to build the tree?
        // No, we can link them post-hoc.

        // Map version ID (or object) to its Node
        const nodeMap = new Map();
        nodeMap.set('root', treeRoot);

        // Create nodes for all versions
        history.forEach(v => {
            nodeMap.set(v.id || v.timestamp, { // Use ID or timestamp as key
                id: v.id || v.timestamp,
                version: v,
                children: []
            });
        });

        // Link nodes
        sortedIndices.forEach((index, i) => {
            const versions = messageGroups.get(index);
            const prevIndex = i > 0 ? sortedIndices[i - 1] : -1;

            versions.forEach(v => {
                const node = nodeMap.get(v.id || v.timestamp);

                if (prevIndex === -1) {
                    // First message, link to root
                    treeRoot.children.push(node);
                } else {
                    // Find parent in previous message group
                    // Note: We need to find the specific VERSION of the previous message
                    // that was active when THIS version was created.
                    // However, if the previous message group has NO versions created before this one...
                    // (e.g. we edited Msg 2 BEFORE we ever edited Msg 0? Possible if we only capture edits)
                    // If we only capture edits, we might miss the "original" unedited version.
                    // In that case, we just link to the closest available parent or Root?

                    // Let's try to find a parent in the previous group
                    const parentVersion = findActiveVersion(prevIndex, v.timestamp);

                    if (parentVersion) {
                        const parentNode = nodeMap.get(parentVersion.id || parentVersion.timestamp);
                        parentNode.children.push(node);
                    } else {
                        // Orphan? Link to root for now to ensure visibility
                        treeRoot.children.push(node);
                    }
                }
            });
        });

        // 4. Render the tree
        // We'll use a recursive flexbox layout
        container.innerHTML = '';
        container.className = 'flex-1 overflow-auto p-8 bg-bg-000 relative min-w-max'; // Ensure horizontal scroll

        const treeContainer = DOMUtils.createElement('div');
        treeContainer.className = 'tree-visualization flex flex-col items-center gap-8';

        // Render Root's children (Top level messages)
        // If multiple top-level branches, show them side-by-side
        const rootRow = DOMUtils.createElement('div');
        rootRow.className = 'flex gap-12 items-start';

        treeRoot.children.forEach(childNode => {
            rootRow.appendChild(this.renderTreeNode(childNode));
        });

        treeContainer.appendChild(rootRow);
        container.appendChild(treeContainer);
    }

    renderTreeNode(node) {
        const wrapper = DOMUtils.createElement('div');
        wrapper.className = 'flex flex-col items-center gap-4 relative';

        // Node Card
        const card = DOMUtils.createElement('div');
        card.className = 'w-64 p-3 rounded-lg border border-border-200 bg-bg-100 hover:border-accent-main-100 hover:shadow-md transition-all cursor-pointer relative z-10';

        const header = DOMUtils.createElement('div');
        header.className = 'flex justify-between items-center mb-2';

        const badge = DOMUtils.createElement('span');
        badge.className = 'text-xs font-bold px-2 py-0.5 rounded bg-accent-main-100 text-white';
        badge.textContent = node.version.versionLabel;

        const time = DOMUtils.createElement('span');
        time.className = 'text-[10px] text-text-400';
        time.textContent = new Date(node.version.timestamp).toLocaleTimeString();

        header.appendChild(badge);
        header.appendChild(time);

        const preview = DOMUtils.createElement('div');
        preview.className = 'text-xs text-text-200 line-clamp-3 font-mono bg-bg-200 p-2 rounded';
        preview.textContent = node.version.content;

        card.appendChild(header);
        card.appendChild(preview);

        card.addEventListener('click', () => {
            this.scrollToMessage(node.version.containerId);
            this.hide();
        });

        wrapper.appendChild(card);

        // Children
        if (node.children.length > 0) {
            // Sort children by timestamp
            node.children.sort((a, b) => a.version.timestamp - b.version.timestamp);

            const childrenWrapper = DOMUtils.createElement('div');
            childrenWrapper.className = 'flex gap-8 items-start pt-8 relative';

            // Vertical line from parent to children wrapper
            const vLine = DOMUtils.createElement('div');
            vLine.className = 'absolute top-0 left-1/2 w-0.5 h-8 bg-border-300 -translate-x-1/2';
            childrenWrapper.appendChild(vLine);

            // Horizontal bar connecting children
            if (node.children.length > 1) {
                const hBar = DOMUtils.createElement('div');
                hBar.className = 'absolute top-8 left-0 right-0 h-0.5 bg-border-300';
                // Adjust width to cover centers of first and last child
                // This is hard to do with pure CSS without knowing widths.
                // Instead, we can use ::before on children to draw lines up to the bar.
                // Let's use a simpler approach:
                // Each child has a top line.
            }

            node.children.forEach((child, idx) => {
                const childEl = this.renderTreeNode(child);

                // Add connector lines
                // Vertical line above child
                const childLine = DOMUtils.createElement('div');
                childLine.className = 'absolute -top-8 left-1/2 w-0.5 h-8 bg-border-300 -translate-x-1/2';
                // We can't easily append this to childEl wrapper without breaking layout flow?
                // Actually, we can put it inside the child wrapper at the top.

                // Let's use a different CSS strategy for tree lines
                childEl.classList.add('tree-node');
                childrenWrapper.appendChild(childEl);
            });

            wrapper.appendChild(childrenWrapper);
        }

        return wrapper;
    }

    scrollToMessage(containerId) {
        // Try to find element by container ID
        // Note: This relies on the DOM having the ID, which might need the scanner to have run
        // Ideally we'd use the scanner's map, but for now we'll try a selector

        // Since we switched to index-based IDs (edit-index-N), we can try to parse N
        // and find the Nth user message.

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

        // Fallback: try attribute
        const el = document.querySelector(`[data-edit-container-id="${containerId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.warn('Could not find message element for', containerId);
        }
    }
}

export default BranchMapModal;
