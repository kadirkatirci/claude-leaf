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
  }

  build() {
    console.log('[BranchTreeBuilder] Building from', this.snapshots.length, 'snapshots');

    if (this.snapshots.length === 0) {
      return { columns: [], messageIndices: [], containerIds: [], paths: [] };
    }

    // Reset
    this.shownNodes.clear();
    this.nodeLocationMap.clear();

    // 1. Snapshot'lardan path'leri çıkar
    const paths = this.extractPaths();
    console.log('[BranchTreeBuilder] Extracted paths:', paths);

    // 2. Ana yolu bul (en uzun path)
    const mainPath = this.findMainPath(paths);
    console.log('[BranchTreeBuilder] Main path:', mainPath);

    // 3. Dal snapshot'larını bul
    const branches = this.findBranches(paths, mainPath);
    console.log('[BranchTreeBuilder] Branches:', branches);

    // 4. Sütunları oluştur
    // ÖNEMLİ: Önce ana yolu işle (shownNodes'a ekle), sonra dalları
    const columns = this.buildColumnsWithMainPathFirst(mainPath, branches);
    console.log('[BranchTreeBuilder] Columns:', columns);

    // 5. Unique değerleri topla
    const messageIndices = this.getAllMessageIndices(paths);
    const containerIds = this.getAllContainerIds(paths);

    return {
      columns,
      messageIndices,
      containerIds,
      mainPath,
      nodeLocationMap: this.nodeLocationMap,
      paths // Snapshot'ların mesaj listeleri (bağlantılar için)
    };
  }

  extractPaths() {
    return this.snapshots.map(snapshot => {
      const messages = snapshot.messages
        .filter(m => m.version !== null)
        .map(m => ({
          containerId: m.containerId,
          version: m.version.replace(/\s+/g, ''),
          messageIndex: parseInt(m.containerId.replace('edit-index-', '')),
          contentPreview: m.contentPreview
        }))
        .sort((a, b) => a.messageIndex - b.messageIndex);

      return {
        snapshotId: snapshot.id,
        timestamp: snapshot.timestamp,
        messages
      };
    });
  }

  findMainPath(paths) {
    if (paths.length === 0) return { messages: [] };
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
        branches.push({
          snapshotId: path.snapshotId,
          messages: path.messages,
          isLeftBranch: isLeft
        });
      }
    });

    // Sol dalları mesaj sayısına göre sırala (kısa olanlar önce)
    // Sağ dalları da aynı şekilde
    branches.sort((a, b) => {
      if (a.isLeftBranch && !b.isLeftBranch) return -1;
      if (!a.isLeftBranch && b.isLeftBranch) return 1;
      return a.messages.length - b.messages.length;
    });

    return branches;
  }

  isLeftBranch(mainMessages, branchMessages) {
    const mainMap = new Map();
    mainMessages.forEach(m => mainMap.set(m.containerId, m));

    for (const branchMsg of branchMessages) {
      const mainMsg = mainMap.get(branchMsg.containerId);
      if (mainMsg && mainMsg.version !== branchMsg.version) {
        const branchV = parseInt(branchMsg.version.split('/')[0]);
        const mainV = parseInt(mainMsg.version.split('/')[0]);
        return branchV < mainV;
      }
      if (!mainMsg) {
        return true;
      }
    }
    return true;
  }

  pathToKey(messages) {
    return messages.map(m => `${m.containerId}:${m.version}`).join('|');
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
        connectFrom: null
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
          connectFrom: connectInfo
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
          connectFrom: connectInfo
        });
      }
    });

    // ========== 3. GÖRSEL SIRAYA GÖRE BİRLEŞTİR ==========
    // Sol dallar → Ana yol → Sağ dallar
    const columns = [];
    
    leftBranchColumns.forEach(col => columns.push(col));
    if (mainColumn) columns.push(mainColumn);
    rightBranchColumns.forEach(col => columns.push(col));

    return columns;
  }

  /**
   * Ana yol için: Tüm node'ları kaydet (filtre yok)
   */
  registerNodes(messages, columnId) {
    const nodes = [];

    messages.forEach(msg => {
      const nodeKey = `${msg.containerId}:${msg.version}`;
      
      const node = {
        containerId: msg.containerId,
        messageIndex: msg.messageIndex,
        version: msg.version,
        contentPreview: msg.contentPreview
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
  filterAndRegisterNodes(messages, columnId) {
    const nodes = [];

    messages.forEach(msg => {
      const nodeKey = `${msg.containerId}:${msg.version}`;
      
      // Daha önce gösterilmemişse ekle
      if (!this.shownNodes.has(nodeKey)) {
        const node = {
          containerId: msg.containerId,
          messageIndex: msg.messageIndex,
          version: msg.version,
          contentPreview: msg.contentPreview
        };
        
        nodes.push(node);
        this.shownNodes.add(nodeKey);
        this.nodeLocationMap.set(nodeKey, { columnId, node });
      }
    });

    return nodes;
  }

  /**
   * Bağlantı kaynağını bul
   */
  findConnectionSource(targetNode) {
    if (!targetNode) return null;

    // Bu node'un messageIndex'inden küçük olan en büyük messageIndex'li node'u bul
    let bestMatch = null;
    let bestMatchIndex = -1;

    this.nodeLocationMap.forEach((location, nodeKey) => {
      const [containerId] = nodeKey.split(':');
      const msgIndex = parseInt(containerId.replace('edit-index-', ''));
      
      if (msgIndex < targetNode.messageIndex && msgIndex > bestMatchIndex) {
        bestMatch = location;
        bestMatchIndex = msgIndex;
      }
    });

    // Yoksa aynı mesajın farklı versiyonunu ara
    if (!bestMatch) {
      this.nodeLocationMap.forEach((location, nodeKey) => {
        const [containerId] = nodeKey.split(':');
        if (containerId === targetNode.containerId) {
          bestMatch = location;
        }
      });
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
