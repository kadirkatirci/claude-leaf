/**
 * BranchTreeBuilder - Snapshot'lardan branch map yapısı oluşturur
 * 
 * Mantık:
 * 1. En uzun path = Ana Yol
 * 2. Ana yoldaki versiyonlardan farklı olanlar = Dallar
 * 3. Sütun sırası: Sol dallar → Ana yol → Sağ dallar
 * 4. Aynı mesaj numarası = Aynı yatay hiza (satır)
 * 5. Dal sütunlarında sadece ana yoldan FARKLI olan mesajlar gösterilir
 * 6. Bağlantı, dallanma noktasından (ana yoldaki son ortak mesaj) başlar
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

    // 3. Dal snapshot'larını bul ve analiz et
    const branches = this.analyzeBranches(paths, mainPath);
    console.log('[BranchTreeBuilder] Branches:', branches);

    // 4. Sütunları oluştur
    const columns = this.buildColumns(mainPath, branches);
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
   * Dal snapshot'larını analiz et
   * Her dal için: farklı mesajlar ve dallanma noktası
   */
  analyzeBranches(paths, mainPath) {
    const mainPathKey = this.pathToKey(mainPath.messages);
    const branches = [];

    paths.forEach(path => {
      const pathKey = this.pathToKey(path.messages);
      
      // Ana yol ile aynı değilse bu bir dal
      if (pathKey !== mainPathKey) {
        // Dallanma noktasını ve farklı mesajları bul
        const analysis = this.analyzeDivergence(mainPath.messages, path.messages);
        
        branches.push({
          snapshotId: path.snapshotId,
          allMessages: path.messages,
          // Sadece ana yoldan farklı olan mesajlar
          uniqueMessages: analysis.uniqueMessages,
          // Dallanma noktası (ana yoldaki son ortak mesajın index'i)
          divergeFromIndex: analysis.divergeFromIndex,
          // Sol mu sağ mı?
          isLeftBranch: analysis.isLeftBranch
        });
      }
    });

    // Sol dalları öne, sağ dalları sona sırala
    branches.sort((a, b) => {
      if (a.isLeftBranch && !b.isLeftBranch) return -1;
      if (!a.isLeftBranch && b.isLeftBranch) return 1;
      // Aynı tarafta ise divergeFromIndex'e göre
      return a.divergeFromIndex - b.divergeFromIndex;
    });

    return branches;
  }

  /**
   * Dallanma analizi: hangi mesajlar farklı, nereden dallanıyor
   */
  analyzeDivergence(mainMessages, branchMessages) {
    const uniqueMessages = [];
    let divergeFromIndex = null;
    let isLeftBranch = false;

    // Ana yol mesajlarını map'e çevir
    const mainMap = new Map();
    mainMessages.forEach(m => {
      mainMap.set(m.containerId, m);
    });

    // Branch mesajlarını kontrol et
    for (let i = 0; i < branchMessages.length; i++) {
      const branchMsg = branchMessages[i];
      const mainMsg = mainMap.get(branchMsg.containerId);

      if (!mainMsg) {
        // Bu mesaj ana yolda yok - farklı
        uniqueMessages.push(branchMsg);
        if (divergeFromIndex === null && i > 0) {
          // Bir önceki mesajdan dallanıyor
          divergeFromIndex = branchMessages[i - 1].messageIndex;
        }
      } else if (mainMsg.version !== branchMsg.version) {
        // Aynı mesaj ama farklı versiyon - farklı
        uniqueMessages.push(branchMsg);
        
        // İlk farklılık = dallanma noktası
        if (divergeFromIndex === null) {
          // Bu mesajın kendisi dallanma noktası değil, bir önceki ortak mesaj
          // Eğer ilk mesajsa, START'tan dallanıyor
          if (i === 0) {
            divergeFromIndex = -1; // START'tan
          } else {
            divergeFromIndex = branchMessages[i - 1].messageIndex;
          }
        }

        // Sol mu sağ mı belirleme (ilk farklı mesaja göre)
        if (uniqueMessages.length === 1) {
          const branchVersion = parseInt(branchMsg.version.split('/')[0]);
          const mainVersion = parseInt(mainMsg.version.split('/')[0]);
          isLeftBranch = branchVersion < mainVersion;
        }
      }
      // Aynı mesaj, aynı versiyon - ortak, atla
    }

    // Eğer hiç farklı mesaj yoksa (tamamen alt küme), tüm mesajlar unique
    if (uniqueMessages.length === 0 && branchMessages.length > 0) {
      uniqueMessages.push(...branchMessages);
      divergeFromIndex = -1;
      isLeftBranch = true;
    }

    // divergeFromIndex hala null ise (tüm mesajlar ortak ama branch daha kısa)
    if (divergeFromIndex === null && branchMessages.length > 0) {
      divergeFromIndex = branchMessages[branchMessages.length - 1].messageIndex;
    }

    return {
      uniqueMessages,
      divergeFromIndex: divergeFromIndex ?? -1,
      isLeftBranch
    };
  }

  /**
   * Path'i string key'e çevir (karşılaştırma için)
   */
  pathToKey(messages) {
    return messages.map(m => `${m.containerId}:${m.version}`).join('|');
  }

  /**
   * Sütunları oluştur
   */
  buildColumns(mainPath, branches) {
    const columns = [];

    // Sol dallar
    const leftBranches = branches.filter(b => b.isLeftBranch);
    leftBranches.forEach((branch, idx) => {
      columns.push({
        id: `left-branch-${idx}`,
        type: 'left-branch',
        divergeFromIndex: branch.divergeFromIndex,
        nodes: branch.uniqueMessages.map(m => ({
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
    const rightBranches = branches.filter(b => !b.isLeftBranch);
    rightBranches.forEach((branch, idx) => {
      columns.push({
        id: `right-branch-${idx}`,
        type: 'right-branch',
        divergeFromIndex: branch.divergeFromIndex,
        nodes: branch.uniqueMessages.map(m => ({
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
