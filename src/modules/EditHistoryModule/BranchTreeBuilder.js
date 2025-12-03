/**
 * BranchTreeBuilder - Snapshot'lardan branch map yapısı oluşturur
 * 
 * Mantık:
 * 1. En uzun path = Ana Yol
 * 2. Ana yoldaki versiyonlardan farklı olanlar = Dallar
 * 3. Sütun sırası: Sol dallar → Ana yol → Sağ dallar
 * 4. Aynı mesaj numarası = Aynı yatay hiza (satır)
 * 5. Aynı snapshot'ta yakalanan mesajlar aynı sütunda (yalnız değil)
 */

class BranchTreeBuilder {
  constructor(snapshots, history) {
    this.snapshots = snapshots || [];
    this.history = history || [];
  }

  /**
   * Ana build metodu
   * @returns {Object} Branch map yapısı
   */
  build() {
    console.log('[BranchTreeBuilder] Building from', this.snapshots.length, 'snapshots');

    if (this.snapshots.length === 0) {
      return { columns: [], messageIndices: [], containerIds: [] };
    }

    // 1. Snapshot'lardan path'leri çıkar
    const paths = this.extractPaths();
    console.log('[BranchTreeBuilder] Extracted paths:', paths);

    // 2. Ana yolu bul (en uzun path)
    const mainPath = this.findMainPath(paths);
    console.log('[BranchTreeBuilder] Main path:', mainPath);

    // 3. Dal snapshot'larını bul (ana yoldan farklı olanlar)
    const branchSnapshots = this.findBranchSnapshots(paths, mainPath);
    console.log('[BranchTreeBuilder] Branch snapshots:', branchSnapshots);

    // 4. Sütunları oluştur
    const columns = this.buildColumns(mainPath, branchSnapshots);
    console.log('[BranchTreeBuilder] Columns:', columns);

    // 5. Unique değerleri topla
    const messageIndices = this.getAllMessageIndices(paths);
    const containerIds = this.getAllContainerIds(paths);

    return {
      columns,
      messageIndices,
      containerIds,
      mainPath
    };
  }

  /**
   * Her snapshot'tan path çıkar
   */
  extractPaths() {
    return this.snapshots.map(snapshot => {
      const messages = snapshot.messages
        .filter(m => m.version !== null)
        .map(m => ({
          containerId: m.containerId,
          version: m.version.replace(/\s+/g, ''), // "2 / 2" -> "2/2"
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

  /**
   * Ana yolu bul (en uzun path)
   */
  findMainPath(paths) {
    if (paths.length === 0) return { messages: [] };
    
    return paths.reduce((longest, current) => 
      current.messages.length > longest.messages.length ? current : longest
    );
  }

  /**
   * Ana yoldan farklı olan snapshot'ları bul
   * Her biri bir dal sütunu olacak
   */
  findBranchSnapshots(paths, mainPath) {
    const mainPathKey = this.pathToKey(mainPath.messages);
    const branches = [];

    paths.forEach(path => {
      const pathKey = this.pathToKey(path.messages);
      
      // Ana yol ile aynı değilse bu bir dal
      if (pathKey !== mainPathKey) {
        // Bu dal, ana yoldan hangi noktada ayrılıyor?
        const divergeIndex = this.findDivergencePoint(mainPath.messages, path.messages);
        
        branches.push({
          snapshotId: path.snapshotId,
          messages: path.messages,
          divergeIndex, // Ana yoldan ayrıldığı messageIndex
          isLeftBranch: this.isLeftBranch(mainPath.messages, path.messages)
        });
      }
    });

    // Sol dalları öne, sağ dalları sona sırala
    branches.sort((a, b) => {
      if (a.isLeftBranch && !b.isLeftBranch) return -1;
      if (!a.isLeftBranch && b.isLeftBranch) return 1;
      // Aynı tarafta ise messageIndex'e göre
      return a.divergeIndex - b.divergeIndex;
    });

    return branches;
  }

  /**
   * Path'i string key'e çevir (karşılaştırma için)
   */
  pathToKey(messages) {
    return messages.map(m => `${m.containerId}:${m.version}`).join('|');
  }

  /**
   * İki path'in hangi noktada ayrıldığını bul
   */
  findDivergencePoint(mainMessages, branchMessages) {
    for (let i = 0; i < branchMessages.length; i++) {
      const branchMsg = branchMessages[i];
      const mainMsg = mainMessages.find(m => m.containerId === branchMsg.containerId);
      
      if (!mainMsg || mainMsg.version !== branchMsg.version) {
        return branchMsg.messageIndex;
      }
    }
    return branchMessages[0]?.messageIndex || 0;
  }

  /**
   * Bu dal sol tarafta mı? (İlk mesajın versiyonu ana yoldan küçükse sol)
   */
  isLeftBranch(mainMessages, branchMessages) {
    if (branchMessages.length === 0) return false;
    
    const firstBranchMsg = branchMessages[0];
    const mainMsg = mainMessages.find(m => m.containerId === firstBranchMsg.containerId);
    
    if (!mainMsg) return true; // Ana yolda yoksa sol
    
    // Versiyon numarasını karşılaştır
    const branchVersion = parseInt(firstBranchMsg.version.split('/')[0]);
    const mainVersion = parseInt(mainMsg.version.split('/')[0]);
    
    return branchVersion < mainVersion;
  }

  /**
   * Sütunları oluştur
   */
  buildColumns(mainPath, branchSnapshots) {
    const columns = [];

    // Sol dallar (ilk mesajın versiyonu ana yoldan küçük olanlar)
    const leftBranches = branchSnapshots.filter(b => b.isLeftBranch);
    leftBranches.forEach((branch, idx) => {
      columns.push({
        id: `left-branch-${idx}`,
        type: 'left-branch',
        nodes: branch.messages.map(m => ({
          containerId: m.containerId,
          messageIndex: m.messageIndex,
          version: m.version,
          contentPreview: m.contentPreview
        }))
      });
    });

    // Ana yol (ortada)
    if (mainPath.messages.length > 0) {
      columns.push({
        id: 'main-path',
        type: 'main',
        nodes: mainPath.messages.map(m => ({
          containerId: m.containerId,
          messageIndex: m.messageIndex,
          version: m.version,
          contentPreview: m.contentPreview
        }))
      });
    }

    // Sağ dallar
    const rightBranches = branchSnapshots.filter(b => !b.isLeftBranch);
    rightBranches.forEach((branch, idx) => {
      columns.push({
        id: `right-branch-${idx}`,
        type: 'right-branch',
        nodes: branch.messages.map(m => ({
          containerId: m.containerId,
          messageIndex: m.messageIndex,
          version: m.version,
          contentPreview: m.contentPreview
        }))
      });
    });

    return columns;
  }

  /**
   * Tüm unique mesaj index'lerini bul
   */
  getAllMessageIndices(paths) {
    const indices = new Set();
    paths.forEach(path => {
      path.messages.forEach(m => indices.add(m.messageIndex));
    });
    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Tüm unique containerId'leri bul
   */
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
