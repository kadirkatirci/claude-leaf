/**
 * BranchTreeBuilder - Snapshot'lardan tree yapısı oluşturur
 * 
 * Mantık:
 * 1. Her snapshot'tan edited message path'i çıkar
 * 2. Path'leri birleştirerek tree oluştur
 * 3. History'den eksik versiyonları ekle (disabled)
 * 4. Current path'i işaretle
 * 
 * Önemli:
 * - Snapshot sırası önemsiz, içerik önemli
 * - Aynı snapshot'taki mesajlar dikey gruplanır
 * - Farklı versiyonlar yatay dallanır
 */

class BranchTreeBuilder {
  constructor(snapshots, history) {
    this.snapshots = snapshots || [];
    this.history = history || [];
  }

  /**
   * Ana build metodu
   * @returns {Object} Tree yapısı
   */
  build() {
    console.log('[BranchTreeBuilder] Building tree from', this.snapshots.length, 'snapshots');

    // 1. Path'leri çıkar
    const paths = this.extractPaths();
    console.log('[BranchTreeBuilder] Extracted paths:', paths);

    // 2. Tree oluştur
    const tree = this.mergePaths(paths);
    console.log('[BranchTreeBuilder] Merged tree:', tree);

    // 3. History'den eksik versiyonları ekle
    this.addMissingVersions(tree);

    // 4. Current path'i işaretle
    this.markCurrentPath(tree);

    // 5. Node'ları messageIndex'e göre sırala
    this.sortChildren(tree);

    return tree;
  }

  /**
   * Her snapshot'tan edited message path'i çıkar
   * @returns {Array} Path listesi
   */
  extractPaths() {
    return this.snapshots.map(snapshot => {
      const editedMessages = snapshot.messages
        .filter(m => m.version !== null)
        .map(m => ({
          containerId: m.containerId,
          version: m.version,
          contentPreview: m.contentPreview,
          messageIndex: parseInt(m.containerId.replace('edit-index-', ''))
        }))
        // messageIndex'e göre sırala (snapshot içi sıra önemli)
        .sort((a, b) => a.messageIndex - b.messageIndex);

      return {
        snapshotId: snapshot.id,
        timestamp: snapshot.timestamp,
        path: editedMessages
      };
    });
  }

  /**
   * Path'leri birleştirerek tree oluştur
   * @param {Array} paths - Path listesi
   * @returns {Object} Tree root
   */
  mergePaths(paths) {
    const root = {
      id: 'START',
      type: 'root',
      children: []
    };

    paths.forEach(pathData => {
      let currentNode = root;

      pathData.path.forEach((item, index) => {
        const nodeId = `${item.containerId}:${item.version}`;

        // Bu node zaten var mı?
        let existingChild = currentNode.children.find(c => c.id === nodeId);

        if (!existingChild) {
          // Yeni node oluştur
          existingChild = {
            id: nodeId,
            containerId: item.containerId,
            version: item.version,
            messageIndex: item.messageIndex,
            contentPreview: item.contentPreview,
            children: [],
            snapshotIds: [],
            disabled: false,
            isCurrent: false
          };
          currentNode.children.push(existingChild);
        }

        // Bu snapshot'ın bu node'dan geçtiğini işaretle
        if (!existingChild.snapshotIds.includes(pathData.snapshotId)) {
          existingChild.snapshotIds.push(pathData.snapshotId);
        }

        // Sonraki node için parent'ı güncelle
        currentNode = existingChild;
      });
    });

    return root;
  }

  /**
   * History'den eksik versiyonları ekle (disabled olarak)
   * @param {Object} tree - Tree root
   */
  addMissingVersions(tree) {
    // History'deki tüm containerId:version kombinasyonlarını topla
    const historyVersions = new Map();
    this.history.forEach(h => {
      const key = `${h.containerId}:${h.versionLabel}`;
      historyVersions.set(key, {
        containerId: h.containerId,
        version: h.versionLabel,
        content: h.content,
        messageIndex: h.messageIndex
      });
    });

    // Tree'deki mevcut node'ları topla
    const existingNodes = new Set();
    this.collectNodeIds(tree, existingNodes);

    // Eksik olanları bul ve ekle
    historyVersions.forEach((data, key) => {
      if (!existingNodes.has(key)) {
        console.log('[BranchTreeBuilder] Adding missing version:', key);
        // Bu versiyon hiçbir snapshot'ta yok - disabled olarak ekle
        this.addDisabledNode(tree, data);
      }
    });
  }

  /**
   * Tree'deki tüm node ID'lerini topla
   * @param {Object} node - Başlangıç node
   * @param {Set} set - Toplanacak set
   */
  collectNodeIds(node, set) {
    if (node.id !== 'START') {
      set.add(node.id);
    }
    node.children.forEach(child => this.collectNodeIds(child, set));
  }

  /**
   * Disabled node ekle (history'de var ama snapshot'ta yok)
   * @param {Object} tree - Tree root
   * @param {Object} data - Version data
   */
  addDisabledNode(tree, data) {
    // Aynı containerId'ye sahip node'u bul
    const siblingNode = this.findNodeByContainerId(tree, data.containerId);

    if (siblingNode) {
      // Sibling'in parent'ına ekle
      const parent = this.findParent(tree, siblingNode.id);
      if (parent) {
        // Zaten eklenmemişse ekle
        const nodeId = `${data.containerId}:${data.version}`;
        const exists = parent.children.some(c => c.id === nodeId);
        
        if (!exists) {
          parent.children.push({
            id: nodeId,
            containerId: data.containerId,
            version: data.version,
            messageIndex: data.messageIndex,
            content: data.content,
            children: [],
            snapshotIds: [],
            disabled: true,
            isCurrent: false
          });
        }
      }
    } else {
      // Hiç sibling yok - root'a ekle
      const nodeId = `${data.containerId}:${data.version}`;
      tree.children.push({
        id: nodeId,
        containerId: data.containerId,
        version: data.version,
        messageIndex: data.messageIndex,
        content: data.content,
        children: [],
        snapshotIds: [],
        disabled: true,
        isCurrent: false
      });
    }
  }

  /**
   * ContainerId'ye göre node bul
   * @param {Object} node - Başlangıç node
   * @param {string} containerId - Aranacak containerId
   * @returns {Object|null} Bulunan node
   */
  findNodeByContainerId(node, containerId) {
    if (node.containerId === containerId) return node;
    for (const child of node.children) {
      const found = this.findNodeByContainerId(child, containerId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Bir node'un parent'ını bul
   * @param {Object} tree - Tree root
   * @param {string} targetId - Hedef node ID
   * @param {Object|null} parent - Mevcut parent
   * @returns {Object|null} Parent node
   */
  findParent(tree, targetId, parent = null) {
    if (tree.id === targetId) return parent;
    for (const child of tree.children) {
      const found = this.findParent(child, targetId, tree);
      if (found) return found;
    }
    return null;
  }

  /**
   * Current path'i işaretle (en son snapshot)
   * @param {Object} tree - Tree root
   */
  markCurrentPath(tree) {
    if (this.snapshots.length === 0) return;

    // En son timestamp'e sahip snapshot
    const latestSnapshot = this.snapshots.reduce((latest, s) =>
      s.timestamp > latest.timestamp ? s : latest
    );

    console.log('[BranchTreeBuilder] Latest snapshot:', latestSnapshot.id);

    this.traverseAndMark(tree, latestSnapshot.id);
  }

  /**
   * Tree'yi traverse ederek current path'i işaretle
   * @param {Object} node - Mevcut node
   * @param {string} targetSnapshotId - Hedef snapshot ID
   */
  traverseAndMark(node, targetSnapshotId) {
    if (node.snapshotIds?.includes(targetSnapshotId)) {
      node.isCurrent = true;
    }
    node.children.forEach(child =>
      this.traverseAndMark(child, targetSnapshotId)
    );
  }

  /**
   * Children'ları messageIndex'e göre sırala (recursive)
   * @param {Object} node - Mevcut node
   */
  sortChildren(node) {
    if (node.children.length > 0) {
      node.children.sort((a, b) => {
        // Önce messageIndex'e göre
        if (a.messageIndex !== b.messageIndex) {
          return a.messageIndex - b.messageIndex;
        }
        // Aynı messageIndex ise version'a göre
        return a.version.localeCompare(b.version);
      });

      node.children.forEach(child => this.sortChildren(child));
    }
  }
}

export default BranchTreeBuilder;
