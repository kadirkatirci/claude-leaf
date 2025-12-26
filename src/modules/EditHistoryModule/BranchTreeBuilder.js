import { debugLog } from '../../config/debug.js';

/**
 * BranchTreeBuilder - Snapshot'lardan branch map yapısı oluşturur
 *
 * Mantık:
 * 1. En uzun path = Ana Yol
 * 2. Ana yoldaki versiyonlardan farklı olanlar = Dallar
 * 3. Sütun sırası: Sol dallar → Ana yol → Sağ dallar
 * 4. Aynı mesaj numarası = Aynı yatay hiza (satır)
 * 5. Global "gösterilen" set ile duplicate'ler filtrelenir
 * 6. ÖNEMLİ: Ana yol önce işlenir, sonra dallar (duplicate önleme için)
 */

class BranchTreeBuilder {
  constructor(snapshots, history) {
    this.snapshots = snapshots || [];
    this.history = history || [];
    this.shownNodes = new Set();
    this.nodeLocationMap = new Map();
    this.containerMaxVersions = new Map(); // Container ID -> Max total versions
  }

  build() {
    debugLog('editHistory', `BranchTreeBuilder building from ${this.snapshots.length} snapshots`);

    if (this.snapshots.length === 0) {
      return { columns: [], messageIndices: [], containerIds: [], paths: [] };
    }

    // Reset
    this.shownNodes.clear();
    this.nodeLocationMap.clear();
    this.containerMaxVersions.clear();

    // 0. Tüm snapshotları tara ve her mesaj için maksimum versiyon sayısını bul
    this.calculateMaxVersions();

    // 1. Snapshot'lardan path'leri çıkar
    const paths = this.extractPaths();
    debugLog('editHistory', 'BranchTreeBuilder extracted paths:', paths);

    // 2. Ana yolu bul (en uzun path)
    const mainPath = this.findMainPath(paths);
    debugLog('editHistory', 'BranchTreeBuilder main path:', mainPath);

    // 3. Dal snapshot'larını bul
    const branches = this.findBranches(paths, mainPath);
    debugLog('editHistory', 'BranchTreeBuilder branches:', branches);

    // 4. Sütunları oluştur
    // ÖNEMLİ: Önce ana yolu işle (shownNodes'a ekle), sonra dalları
    const columns = this.buildColumnsWithMainPathFirst(mainPath, branches);
    debugLog('editHistory', 'BranchTreeBuilder columns:', columns);

    // 5. Unique değerleri topla
    const messageIndices = this.getAllMessageIndices(paths);
    const containerIds = this.getAllContainerIds(paths);

    return {
      columns,
      messageIndices,
      containerIds,
      mainPath,
      nodeLocationMap: this.nodeLocationMap,
      paths, // Snapshot'ların mesaj listeleri (bağlantılar için)
    };
  }

  /**
   * Get full content from history for a specific message version
   */
  getFullContent(containerId, version, previewText) {
    // Normalize version format (remove spaces) for matching
    const normalizedVersion = version.replace(/\s+/g, '');

    // Find all matching history entries
    const matches = this.history.filter(h => {
      const historyVersion = h.versionLabel ? h.versionLabel.replace(/\s+/g, '') : '';
      return h.containerId === containerId && historyVersion === normalizedVersion;
    });

    if (matches.length === 0) {
      return null;
    }
    // Removed early return for single match to allow preview verification logic to run
    // if (matches.length === 1) return matches[0].content;

    // Disambiguate using previewText if we have multiple matches
    if (previewText) {
      // Clean preview text (remove ellipses, whitespace) for looser matching
      const cleanPreview = previewText.replace(/\.{3}$/, '').trim();

      const bestMatch = matches.find(m => {
        return m.content && m.content.includes(cleanPreview);
      });

      if (bestMatch) {
        return bestMatch.content;
      }

      // CRITICAL FIX: If we have a preview but NO match in history contains it,
      // it means the history is stale or incomplete.
      // Instead of showing the WRONG content (from the fallback match),
      // we show the preview itself (which we know is correct for this node).
      if (cleanPreview.length > 5) {
        // Only if preview is substantial
        return previewText;
      }
    }

    // Fallback: return the last match (often the most recent)
    return matches[matches.length - 1].content;
  }

  /**
   * Her container için maksimum versiyon sayısını hesapla
   * Örn: Bir mesajın 1/2, 2/2 versiyonları var, sonra 1/3, 2/3, 3/3 oldu.
   * Max versiyon sayısı 3 olmalı.
   */
  calculateMaxVersions() {
    // History'den kontrol et
    this.history.forEach(h => {
      if (h.versionLabel) {
        const parts = h.versionLabel.split('/');
        if (parts.length === 2) {
          const total = parseInt(parts[1]);
          const currentMax = this.containerMaxVersions.get(h.containerId) || 0;
          if (total > currentMax) {
            this.containerMaxVersions.set(h.containerId, total);
          }
        }
      }
    });

    // Snapshotlardan kontrol et
    this.snapshots.forEach(snapshot => {
      snapshot.messages.forEach(m => {
        if (m.version) {
          const parts = m.version.split('/');
          if (parts.length === 2) {
            const total = parseInt(parts[1]);
            const currentMax = this.containerMaxVersions.get(m.containerId) || 0;
            if (total > currentMax) {
              this.containerMaxVersions.set(m.containerId, total);
            }
          }
        }
      });
    });
  }

  /**
   * Generate a simple hash from content string
   */
  generateContentHash(content) {
    if (!content) {
      return 'empty';
    }
    let hash = 0;
    const str = content.substring(0, 100); // Only hash start for performance
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Generate a stable unique ID based on content lineage
   * Format: hash(parentId + containerId + versionIndex + contentHash)
   */
  generateUniqueId(containerId, versionIndex, parentId, content) {
    const contentHash = this.generateContentHash(content);
    return `${parentId || 'root'}>${containerId}:v${versionIndex}:${contentHash}`;
  }

  extractPaths() {
    return this.snapshots.map(snapshot => {
      // 1. Raw parsing and sorting
      const parsedMessages = snapshot.messages
        .filter(m => m.version !== null)
        .map(m => {
          const containerId = m.containerId;
          const versionParts = m.version.split('/');
          const currentVer = parseInt(versionParts[0]);
          // Use raw version from snapshot for display (e.g. "2/2")
          // We will update it dynamically later if we find a higher total on a shared node
          const displayVersion = m.version;
          const messageIndex = parseInt(containerId.replace('edit-index-', ''));

          return {
            containerId,
            version: displayVersion,
            versionIndex: currentVer,
            messageIndex,
            contentPreview: m.contentPreview,
            rawVersion: m.version, // Keep original for lookups
          };
        })
        .sort((a, b) => a.messageIndex - b.messageIndex);

      // 2. Sequential unique ID generation (lineage-based)
      let lastNodeId = null;

      const messagesWithIds = parsedMessages.map(m => {
        // Get full content - use preview for disambiguation
        const fullContent = this.getFullContent(
          m.containerId,
          m.rawVersion.replace(/\s+/g, ''),
          m.contentPreview
        );

        // Include content in ID generation
        const uniqueId = this.generateUniqueId(
          m.containerId,
          m.versionIndex,
          lastNodeId,
          fullContent || m.contentPreview
        );
        const currentParentId = lastNodeId; // Store parentId before updating lastNodeId
        lastNodeId = uniqueId; // Update lastNodeId for the next iteration

        return {
          uniqueId, // Lineage-based unique ID
          parentId: currentParentId, // This is the uniqueId of the node that came before this one
          containerId: m.containerId,
          version: m.version,
          versionIndex: m.versionIndex,
          messageIndex: m.messageIndex,
          content: fullContent || m.contentPreview || 'No content available',
        };
      });

      return {
        snapshotId: snapshot.id,
        timestamp: snapshot.timestamp,
        messages: messagesWithIds,
      };
    });
  }

  findMainPath(paths) {
    if (paths.length === 0) {
      return { messages: [] };
    }
    return paths.reduce((longest, current) =>
      current.messages.length > longest.messages.length ? current : longest
    );
  }

  findBranches(paths, mainPath) {
    const mainPathKey = this.pathToKey(mainPath.messages);
    const branches = [];

    paths.forEach(path => {
      const pathKey = this.pathToKey(path.messages);

      if (pathKey !== mainPathKey) {
        const isLeft = this.isLeftBranch(mainPath.messages, path.messages);

        // Find the divergence point (parent ID)
        // The first message in the branch that is DIFFERENT from main path
        // Its parent is the divergence point.
        let divergenceParentId = 'root';
        if (path.messages.length > 0) {
          // Since messages are sequential and include parentId, we can just look at the first message's parent
          // However, the first message might BE the divergence point or it might be shared.

          // Actually, we want to know "where did this branch split off from the main path?"
          // We iterate until we find a message NOT in main path.
          const firstUniqueMsg = path.messages.find(
            pm => !mainPath.messages.some(mm => mm.uniqueId === pm.uniqueId)
          );
          if (firstUniqueMsg) {
            divergenceParentId = firstUniqueMsg.parentId || 'root';
          }
        }

        branches.push({
          snapshotId: path.snapshotId,
          messages: path.messages,
          isLeftBranch: isLeft,
          divergenceParentId,
        });
      }
    });

    // Sol dalları sırala:
    // 1. Divergence Parent ID (kardeşleri bir arada tutmak için)
    // 2. Mesaj sayısı (uzunluk)
    branches.sort((a, b) => {
      if (a.isLeftBranch && !b.isLeftBranch) {
        return -1;
      }
      if (!a.isLeftBranch && b.isLeftBranch) {
        return 1;
      }

      // Group siblings locally
      if (a.divergenceParentId !== b.divergenceParentId) {
        return a.divergenceParentId.localeCompare(b.divergenceParentId);
      }

      return a.messages.length - b.messages.length;
    });

    return branches;
  }

  isLeftBranch(mainMessages, branchMessages) {
    for (const branchMsg of branchMessages) {
      // Find matching message in main path by Unique ID
      const mainMsg = mainMessages.find(m => m.uniqueId === branchMsg.uniqueId);

      // If no exact match (same lineage), check if it's a version divergence
      if (!mainMsg) {
        // Find main message with same container ID to compare versions
        const correspondingMainMsg = mainMessages.find(
          m => m.containerId === branchMsg.containerId
        );

        if (correspondingMainMsg) {
          // Divergence point found: compare versions
          return branchMsg.versionIndex < correspondingMainMsg.versionIndex;
        }

        // No ID match and no Container ID match -> This message is unique to branch
        return true;
      }
    }
    return true;
  }

  pathToKey(messages) {
    // Unique key: Sequence of Unique IDs
    return messages.map(m => m.uniqueId).join('|');
  }

  /**
   * Sütunları oluştur - ANA YOL ÖNCE işlenir
   */
  buildColumnsWithMainPathFirst(mainPath, branches) {
    const leftBranchColumns = [];
    const rightBranchColumns = [];
    let mainColumn = null;

    // ========== 1. ÖNCE ANA YOLU İŞLE (shownNodes'a ekle) ==========
    if (mainPath.messages.length > 0) {
      const columnId = 'main-path';
      const nodes = this.registerNodes(mainPath.messages, columnId);

      mainColumn = {
        id: columnId,
        type: 'main',
        nodes,
        connectFrom: null,
      };
    }

    // ========== 2. SONRA DALLARI İŞLE ==========
    const leftBranches = branches.filter(b => b.isLeftBranch);
    const rightBranches = branches.filter(b => !b.isLeftBranch);

    // Sol dallar
    leftBranches.forEach((branch, idx) => {
      const columnId = `left-branch-${idx}`;
      const nodes = this.filterAndRegisterNodes(branch.messages, columnId);

      if (nodes.length > 0) {
        const connectInfo = this.findConnectionSource(nodes[0]);
        leftBranchColumns.push({
          id: columnId,
          type: 'left-branch',
          nodes,
          connectFrom: connectInfo,
        });
      }
    });

    // Sağ dallar
    rightBranches.forEach((branch, idx) => {
      const columnId = `right-branch-${idx}`;
      const nodes = this.filterAndRegisterNodes(branch.messages, columnId);

      if (nodes.length > 0) {
        const connectInfo = this.findConnectionSource(nodes[0]);
        rightBranchColumns.push({
          id: columnId,
          type: 'right-branch',
          nodes,
          connectFrom: connectInfo,
        });
      }
    });

    // ========== 3. GÖRSEL SIRAYA GÖRE BİRLEŞTİR ==========
    // Sol dallar → Ana yol → Sağ dallar
    const columns = [];

    leftBranchColumns.forEach(col => columns.push(col));
    if (mainColumn) {
      columns.push(mainColumn);
    }
    rightBranchColumns.forEach(col => columns.push(col));

    return columns;
  }

  /**
   * Ana yol için: Tüm node'ları kaydet (filtre yok)
   */
  registerNodes(messages, columnId) {
    const nodes = [];

    messages.forEach(msg => {
      // Node Key uses Lineage ID
      const nodeKey = msg.uniqueId;

      const node = {
        uniqueId: msg.uniqueId,
        parentId: msg.parentId,
        containerId: msg.containerId,
        messageIndex: msg.messageIndex,
        version: msg.version,
        versionIndex: msg.versionIndex,
        content: msg.content,
      };

      nodes.push(node);
      this.shownNodes.add(nodeKey);
      this.nodeLocationMap.set(nodeKey, { columnId, node });
    });

    return nodes;
  }

  /**
   * Dallar için: Duplicate kontrolü yap
   */
  /**
   * Dallar için: Duplicate kontrolü yap
   */
  filterAndRegisterNodes(messages, columnId) {
    const nodes = [];

    messages.forEach(msg => {
      // Node Key uses Lineage ID
      const nodeKey = msg.uniqueId;

      // Daha önce gösterilmemişse ekle
      if (!this.shownNodes.has(nodeKey)) {
        const node = {
          uniqueId: msg.uniqueId,
          parentId: msg.parentId,
          containerId: msg.containerId,
          messageIndex: msg.messageIndex,
          version: msg.version,
          versionIndex: msg.versionIndex,
          content: msg.content,
        };

        nodes.push(node);
        this.shownNodes.add(nodeKey);
        this.nodeLocationMap.set(nodeKey, { columnId, node });
      } else {
        // Node exists -> Check if we need to update the version label (e.g. 1/2 -> 1/3)
        const location = this.nodeLocationMap.get(nodeKey);
        if (location) {
          const existingNode = location.node;
          const existingParts = existingNode.version.split('/');
          const newParts = msg.version.split('/');

          if (existingParts.length === 2 && newParts.length === 2) {
            const existingTotal = parseInt(existingParts[1]);
            const newTotal = parseInt(newParts[1]);

            if (newTotal > existingTotal) {
              // Upgrade the version label to show higher total
              existingNode.version = msg.version;
            }
          }
        }
      }
    });

    return nodes;
  }

  /**
   * Bağlantı kaynağını bul
   */
  findConnectionSource(targetNode) {
    if (!targetNode) {
      return null;
    }

    // Strict Parent-Child Connection
    // Instead of guessing based on index, we look for the EXACT parent node.
    let bestMatch = null;

    // Use loop for performance instead of forEach
    for (const [nodeKey, location] of this.nodeLocationMap) {
      if (location.node.uniqueId === targetNode.parentId) {
        bestMatch = location;
        break; // Found the exact parent, stop searching
      }
    }

    return bestMatch;
  }

  getAllMessageIndices(paths) {
    const indices = new Set();
    paths.forEach(path => {
      path.messages.forEach(m => indices.add(m.messageIndex));
    });
    return Array.from(indices).sort((a, b) => a - b);
  }

  getAllContainerIds(paths) {
    const ids = new Set();
    paths.forEach(path => {
      path.messages.forEach(m => ids.add(m.containerId));
    });
    return Array.from(ids).sort((a, b) => {
      const indexA = parseInt(a.replace('edit-index-', ''));
      const indexB = parseInt(b.replace('edit-index-', ''));
      return indexA - indexB;
    });
  }
}

export default BranchTreeBuilder;
