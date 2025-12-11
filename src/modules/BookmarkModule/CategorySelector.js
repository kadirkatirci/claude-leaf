import { bookmarkStore } from '../../stores/index.js';
import { cn } from '../../utils/ClassNames.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';

/**
 * CategorySelector - Popover for selecting a category when bookmarking
 */
export class CategorySelector {
    constructor(domUtils) {
        this.dom = domUtils;
        this.popover = null;
    }

    async show(targetElement, currentCategoryId, onSelect, onRemove = null, onEdit = null) {
        this.close(); // Close existing

        const categories = await bookmarkStore.getCategories();

        // Create popover container
        this.popover = document.createElement('div');
        this.popover.className = cn(
            'claude-category-popover',
            'fixed',
            'z-50',
            'bg-bg-100',
            'border',
            'border-border-300',
            'rounded-lg',
            'shadow-xl',
            'flex',
            'flex-col',
            'w-64',
            'overflow-hidden',
            'animate-in',
            'fade-in',
            'zoom-in-95',
            'duration-100'
        );

        // Header
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between p-3 border-b border-border-200 bg-bg-200/50';
        header.innerHTML = '<span class="text-sm font-medium text-text-100">Select Category</span>';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'text-text-400 hover:text-text-100 transition-colors';
        closeBtn.innerHTML = IconLibrary.close('currentColor', 16);
        closeBtn.onclick = (e) => { e.stopPropagation(); this.close(); };
        header.appendChild(closeBtn);
        this.popover.appendChild(header);

        // Categories list
        const list = document.createElement('div');
        list.className = 'flex flex-col p-1 max-h-60 overflow-y-auto';

        categories.forEach(category => {
            const item = document.createElement('button');
            const isActive = category.id === currentCategoryId;

            item.className = cn(
                'flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors',
                isActive ? 'bg-accent-main-100/10 text-accent-main-100' : 'hover:bg-bg-200 text-text-200'
            );

            // Color dot
            const dot = document.createElement('span');
            dot.className = 'w-3 h-3 rounded-full';
            dot.style.backgroundColor = category.color;

            // Name
            const name = document.createElement('span');
            name.textContent = category.name;
            name.className = 'flex-1 truncate';

            // Checkmark (if active)
            item.innerHTML = '';
            item.appendChild(dot);
            item.appendChild(name);

            if (isActive) {
                const check = document.createElement('span');
                check.innerHTML = IconLibrary.check('currentColor', 14);
                item.appendChild(check);
            }

            item.onclick = (e) => {
                e.stopPropagation();
                onSelect(category.id);
                this.close();
            };

            list.appendChild(item);
        });

        this.popover.appendChild(list);

        // Actions footer (Remove / Edit)
        if (onRemove || onEdit) {
            const footer = document.createElement('div');
            footer.className = 'p-2 border-t border-border-200 grid grid-cols-1 gap-1 bg-bg-000';

            if (onRemove) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'flex items-center justify-center gap-2 w-full p-2 text-xs text-text-300 hover:text-danger-100 hover:bg-danger-100/10 rounded-md transition-colors';
                removeBtn.innerHTML = `${IconLibrary.trash('currentColor', 12)} Remove Bookmark`;
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    onRemove();
                    this.close();
                };
                footer.appendChild(removeBtn);
            }

            this.popover.appendChild(footer);
        }

        // Append to body to measure
        document.body.appendChild(this.popover);

        // Position popover
        this.position(targetElement);

        // Click outside handler (delayed to avoid immediate close)
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick);
        }, 100);
    }

    position(targetElement) {
        if (!this.popover) return;

        const rect = targetElement.getBoundingClientRect();
        const popoverRect = this.popover.getBoundingClientRect();

        // Default: Show to the left of the button
        let top = rect.top;
        let left = rect.left - popoverRect.width - 8;

        // Boundary checks
        if (left < 10) {
            // If too close to left edge, show on right
            left = rect.right + 8;
        }

        if (top + popoverRect.height > window.innerHeight) {
            // If too close to bottom, align bottom
            top = rect.bottom - popoverRect.height;
        }

        // Ensure it's not offscreen top
        if (top < 10) top = 10;

        this.popover.style.top = `${top}px`;
        this.popover.style.left = `${left}px`;
    }

    close() {
        if (this.popover) {
            this.popover.remove();
            this.popover = null;
        }
        document.removeEventListener('click', this.handleOutsideClick);
    }

    /**
     * Handle outside click
     */
    handleOutsideClick = (e) => {
        if (this.popover && !this.popover.contains(e.target)) {
            this.close();
        }
    }
}
