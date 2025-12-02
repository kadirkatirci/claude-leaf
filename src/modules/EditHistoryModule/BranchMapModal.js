import DOMUtils from '../../utils/DOMUtils.js';
import { editHistoryStore } from '../../stores/index.js';
import BranchTreeBuilder from './BranchTreeBuilder.js';
import BranchMapRenderer from './BranchMapRenderer.js';

/**
 * BranchMapModal - Conversation branch haritasını gösteren modal
 * 
 * Özellikler:
 * - Snapshot'lardan oluşturulan branch yapısını görselleştirir
 * - Aynı mesaj numarası = aynı yatay hiza
 * - Devam eden path'ler aynı sütunda
 * - Yalnız kalanlar kendi sütununda
 */
class BranchMapModal {
    constructor() {
        this.overlay = null;
        this.modal = null;
        this.isVisible = false;
        this.renderer = null;
    }

    /**
     * Modal'ı göster
     * @param {string} conversationUrl - Conversation URL
     */
    async show(conversationUrl) {
        if (this.isVisible) return;

        // Fetch all snapshots for this conversation
        const snapshots = await editHistoryStore.getSnapshots(conversationUrl);
        const history = await editHistoryStore.getByConversation(conversationUrl);

        if ((!snapshots || snapshots.length === 0) && (!history || history.length === 0)) {
            this.showEmptyState();
            return;
        }

        console.log(`[BranchMapModal] Loaded ${snapshots?.length || 0} snapshots, ${history?.length || 0} history entries`);

        this.createModal(snapshots || [], history || []);
        this.isVisible = true;
        document.body.style.overflow = 'hidden';
    }

    /**
     * Modal'ı gizle
     */
    hide() {
        if (!this.isVisible) return;

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }

        this.modal = null;
        this.renderer = null;
        this.isVisible = false;
        document.body.style.overflow = '';
    }

    /**
     * Boş state göster
     */
    showEmptyState() {
        const toast = DOMUtils.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-bg-200 text-text-100 px-4 py-3 rounded-lg shadow-lg z-[10002] flex items-center gap-2';
        toast.innerHTML = `
            <span>📭</span>
            <span>No edit history captured yet. Navigate through edited messages to capture snapshots.</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Modal oluştur
     * @param {Array} snapshots - Snapshot listesi
     * @param {Array} history - History listesi
     */
    createModal(snapshots, history) {
        // Overlay
        this.overlay = DOMUtils.createElement('div');
        this.overlay.className = 'fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-6 backdrop-blur-sm';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Modal Container
        this.modal = DOMUtils.createElement('div');
        this.modal.className = 'bg-bg-000 rounded-xl shadow-2xl w-[95vw] max-w-[1400px] h-[85vh] flex flex-col border border-border-200 overflow-hidden';

        // Header
        const header = this.createHeader(snapshots, history);

        // Content Area
        const content = DOMUtils.createElement('div');
        content.className = 'flex-1 overflow-auto bg-bg-000 relative';
        content.id = 'branch-map-content';

        // Help text
        const helpText = DOMUtils.createElement('div');
        helpText.className = 'absolute bottom-4 left-4 text-xs text-text-400 bg-bg-100/80 px-3 py-1.5 rounded-full backdrop-blur-sm';
        helpText.textContent = '🖱️ Drag to pan • Scroll to zoom • Click node to navigate';

        this.modal.appendChild(header);
        this.modal.appendChild(content);
        content.appendChild(helpText);
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        // Render the map AFTER the modal is in the DOM
        requestAnimationFrame(() => {
            try {
                this.renderBranchMap(content, snapshots, history);
            } catch (error) {
                console.error('[BranchMapModal] Render error:', error);
                content.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-text-300">
                        <span class="text-4xl mb-4">😕</span>
                        <p class="text-lg">Failed to render branch map</p>
                        <p class="text-sm mt-2 text-text-400">${error.message}</p>
                    </div>
                `;
            }
        });
    }

    /**
     * Header oluştur
     * @param {Array} snapshots - Snapshot listesi
     * @param {Array} history - History listesi
     */
    createHeader(snapshots, history) {
        const header = DOMUtils.createElement('div');
        header.className = 'p-4 border-b border-border-200 flex justify-between items-center bg-bg-100';

        // Title
        const titleContainer = DOMUtils.createElement('div');
        titleContainer.className = 'flex items-center gap-3';

        const title = DOMUtils.createElement('h2');
        title.className = 'text-lg font-semibold text-text-100 flex items-center gap-2';
        title.innerHTML = '🗺️ Chat Branch Map';

        // Stats badges
        const statsContainer = DOMUtils.createElement('div');
        statsContainer.className = 'flex items-center gap-2';

        if (snapshots.length > 0) {
            const snapshotBadge = DOMUtils.createElement('span');
            snapshotBadge.className = 'text-xs font-normal text-text-300 bg-bg-200 px-2 py-0.5 rounded-full';
            snapshotBadge.textContent = `${snapshots.length} snapshots`;
            statsContainer.appendChild(snapshotBadge);
        }

        // Count unique edited messages
        const uniqueMessages = new Set();
        history.forEach(h => uniqueMessages.add(h.containerId));
        if (uniqueMessages.size > 0) {
            const msgBadge = DOMUtils.createElement('span');
            msgBadge.className = 'text-xs font-normal text-text-300 bg-bg-200 px-2 py-0.5 rounded-full';
            msgBadge.textContent = `${uniqueMessages.size} edited messages`;
            statsContainer.appendChild(msgBadge);
        }

        titleContainer.appendChild(title);
        titleContainer.appendChild(statsContainer);

        // Close button
        const closeBtn = DOMUtils.createElement('button');
        closeBtn.className = 'p-2 hover:bg-bg-200 rounded-lg transition-colors text-text-300 hover:text-text-100';
        closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        closeBtn.addEventListener('click', () => this.hide());

        header.appendChild(titleContainer);
        header.appendChild(closeBtn);

        return header;
    }

    /**
     * Branch map'i renderla
     * @param {HTMLElement} container - Container element
     * @param {Array} snapshots - Snapshot listesi
     * @param {Array} history - History listesi
     */
    renderBranchMap(container, snapshots, history) {
        console.log('[BranchMapModal] Building branch map...');

        // Tree/data yapısını oluştur
        const builder = new BranchTreeBuilder(snapshots, history);
        const data = builder.build();

        console.log('[BranchMapModal] Data built:', data);

        // Boş data kontrolü
        if (!data.columns || data.columns.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-text-300">
                    <span class="text-4xl mb-4">🌱</span>
                    <p class="text-lg">No branches to display</p>
                    <p class="text-sm mt-2 text-text-400">Edit some messages and navigate between versions to see the branch map.</p>
                </div>
            `;
            return;
        }

        // Render
        console.log('[BranchMapModal] Rendering...');
        this.renderer = new BranchMapRenderer(container, data);
        this.renderer.render();

        // Node click handler
        container.addEventListener('branchmap:nodeclick', (e) => {
            const node = e.detail.node;
            console.log('[BranchMapModal] Node clicked:', node);
            
            if (node.containerId) {
                this.scrollToMessage(node.containerId);
                this.hide();
            }
        });

        console.log('[BranchMapModal] Render complete');
    }

    /**
     * Mesaja scroll yap
     * @param {string} containerId - Container ID (edit-index-X)
     */
    scrollToMessage(containerId) {
        if (!containerId.startsWith('edit-index-')) {
            console.warn('[BranchMapModal] Invalid containerId:', containerId);
            return;
        }

        const index = parseInt(containerId.replace('edit-index-', ''));
        const userMessages = document.querySelectorAll('[data-testid="user-message"]');
        
        if (userMessages[index]) {
            userMessages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Highlight effect
            const el = userMessages[index].closest('.font-user-message') || userMessages[index];
            el.style.transition = 'background-color 0.5s, box-shadow 0.5s';
            el.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
            el.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.4)';
            
            setTimeout(() => {
                el.style.backgroundColor = '';
                el.style.boxShadow = '';
            }, 2500);
            
            return;
        }

        console.warn('[BranchMapModal] Could not find message element for', containerId);
    }
}

export default BranchMapModal;
