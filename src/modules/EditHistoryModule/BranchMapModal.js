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
        this.overlay.className = 'fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-8 backdrop-blur-sm';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Modal Container
        this.modal = DOMUtils.createElement('div');
        this.modal.className = 'bg-bg-000 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col border border-border-200 overflow-hidden';

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
        // Group by message (containerId)
        const messageGroups = {};
        history.forEach(item => {
            if (!messageGroups[item.containerId]) {
                messageGroups[item.containerId] = [];
            }
            messageGroups[item.containerId].push(item);
        });

        // Sort groups by timestamp of their first edit (approximate message order)
        const sortedGroups = Object.values(messageGroups).sort((a, b) => {
            return a[0].timestamp - b[0].timestamp;
        });

        // Timeline Container
        const timeline = DOMUtils.createElement('div');
        timeline.className = 'flex flex-col gap-8 max-w-3xl mx-auto';

        sortedGroups.forEach((group, groupIndex) => {
            // Sort versions within group
            group.sort((a, b) => a.timestamp - b.timestamp);

            // Message Block
            const block = DOMUtils.createElement('div');
            block.className = 'relative pl-8 border-l-2 border-border-200 pb-8 last:border-0';

            // Message Indicator (Dot on main line)
            const indicator = DOMUtils.createElement('div');
            indicator.className = 'absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-accent-main-100 border-4 border-bg-000';
            block.appendChild(indicator);

            // Message Header
            const msgHeader = DOMUtils.createElement('div');
            msgHeader.className = 'mb-4 text-sm font-medium text-text-300';
            msgHeader.textContent = `Message #${groupIndex + 1} (${group.length} versions)`;
            block.appendChild(msgHeader);

            // Versions Grid
            const grid = DOMUtils.createElement('div');
            grid.className = 'grid grid-cols-1 gap-4';

            group.forEach((version, vIndex) => {
                const card = DOMUtils.createElement('div');
                card.className = 'p-4 rounded-lg border border-border-200 bg-bg-100 hover:border-accent-main-100 transition-colors cursor-pointer group';

                // Header
                const cardHeader = DOMUtils.createElement('div');
                cardHeader.className = 'flex justify-between items-center mb-2';

                const versionBadge = DOMUtils.createElement('span');
                versionBadge.className = 'text-xs font-bold px-2 py-0.5 rounded bg-accent-main-100 text-white';
                versionBadge.textContent = version.versionLabel || `v${vIndex + 1}`;

                const time = DOMUtils.createElement('span');
                time.className = 'text-xs text-text-400';
                time.textContent = new Date(version.timestamp).toLocaleString();

                cardHeader.appendChild(versionBadge);
                cardHeader.appendChild(time);

                // Preview
                const preview = DOMUtils.createElement('div');
                preview.className = 'text-sm text-text-200 line-clamp-3 font-mono bg-bg-200 p-2 rounded';
                preview.textContent = version.content;

                card.appendChild(cardHeader);
                card.appendChild(preview);

                // Click to scroll to message
                card.addEventListener('click', () => {
                    this.scrollToMessage(version.containerId);
                    this.hide();
                });

                grid.appendChild(card);
            });

            block.appendChild(grid);
            timeline.appendChild(block);
        });

        container.appendChild(timeline);
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
