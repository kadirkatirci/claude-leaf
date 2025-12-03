/**
 * BranchTreeBuilder - Snapshot'lardan branch map yapısı oluşturur
 * 
 * Mantık:
 * 1. En uzun path = Ana Yol
 * 2. Ana yoldaki versiyonlardan farklı olanlar = Dallar
 * 3. Sütun sırası: Sol dallar → Ana yol → Sağ dallar
 * 4. Aynı mesaj numarası = Aynı yatay hiza (satır)
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

    // 3. Tüm mesajları ve versiyonlarını analiz et
    const messageAnalysis = this.analyzeMessages(paths, mainPath);
    console.log('[BranchTreeBuilder] Message analysis:', messageAnalysis);

    // 4. Sütunları oluştur
    const columns = this.buildColumns(mainPath, messageAnalysis);
    console.log('[BranchTreeBuilder] Columns:', columns);

    // 5. Unique değerleri topla
    const messageIndices = this.getMessageIndices(messageAnalysis);
    const containerIds = Array.from(messageAnalysis.keys()).sort((a, b) => {
      const indexA = parseInt(a.replace('edit-index-', ''));
      const indexB = parseInt(b.replace('edit-index-', ''));
      return indexA - indexB;
    });

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
   * Tüm mesajları ve versiyonlarını analiz et
   * Her mesaj için: ana yol versiyonu ve dal versiyonları
   */
  analyzeMessages(paths, mainPath) {
    // Map: containerId -> { mainVersion, branches: [], messageIndex }
    const analysis = new Map();

    // Önce ana yoldan mesajları ekle
    mainPath.messages.forEach(msg => {
      analysis.set(msg.containerId, {
        containerId: msg.containerId,
        messageIndex: msg.messageIndex,
        mainVersion: msg.version,
        mainContentPreview: msg.contentPreview,
        branches: []
      });
    });

    // Diğer path'lerden dal versiyonlarını bul
    paths.forEach(path => {
      path.messages.forEach(msg => {
        if (!analysis.has(msg.containerId)) {
          // Bu mesaj ana yolda yok - yeni entry oluştur
          analysis.set(msg.containerId, {
            containerId: msg.containerId,
            messageIndex: msg.messageIndex,
            mainVersion: null,
            mainContentPreview: null,
            branches: []
          });
        }

        const entry = analysis.get(msg.containerId);
        
        // Ana yol versiyonundan farklıysa dal olarak ekle
        if (msg.version !== entry.mainVersion) {
          // Zaten eklenmemişse ekle
          const exists = entry.branches.some(b => b.version === msg.version);
          if (!exists) {
            entry.branches.push({
              version: msg.version,
              contentPreview: msg.contentPreview,
              snapshotId: path.snapshotId
            });
          }
        }
      });
    });

    // Dal versiyonlarını sırala (küçükten büyüğe)
    analysis.forEach(entry => {
      entry.branches.sort((a, b) => {
        const vA = parseInt(a.version.split('/')[0]);
        const vB = parseInt(b.version.split('/')[0]);
        return vA - vB;
      });
    });

    return analysis;
  }

  /**
   * Sütunları oluştur
   * Sıra: Sol dallar → Ana yol → Sağ dallar
   */
  buildColumns(mainPath, messageAnalysis) {
    const columns = [];
    const messageIndices = this.getMessageIndices(messageAnalysis);

    // İlk mesajın dallarını bul (sol dallar)
    const firstMsgIndex = messageIndices[0];
    const firstMsgContainerId = `edit-index-${firstMsgIndex}`;
    const firstMsgAnalysis = messageAnalysis.get(firstMsgContainerId);

    if (firstMsgAnalysis && firstMsgAnalysis.branches.length > 0) {
      // Her dal için ayrı sütun (solda)
      firstMsgAnalysis.branches.forEach((branch, idx) => {
        columns.push({
          id: `left-branch-${idx}`,
          type: 'left-branch',
          nodes: [{
            containerId: firstMsgContainerId,
            messageIndex: firstMsgIndex,
            version: branch.version,
            contentPreview: branch.contentPreview
          }]
        });
      });
    }

    // Ana yol sütunu (ortada)
    if (mainPath.messages.length > 0) {
      columns.push({
        id: 'main-path',
        type: 'main',
        nodes: mainPath.messages.map(msg => ({
          containerId: msg.containerId,
          messageIndex: msg.messageIndex,
          version: msg.version,
          contentPreview: msg.contentPreview
        }))
      });
    }

    // Sonraki mesajların dallarını bul (sağ dallar)
    messageIndices.slice(1).forEach(msgIndex => {
      const containerId = `edit-index-${msgIndex}`;
      const msgAnalysis = messageAnalysis.get(containerId);

      if (msgAnalysis && msgAnalysis.branches.length > 0) {
        // Her dal için ayrı sütun (sağda)
        msgAnalysis.branches.forEach((branch, idx) => {
          columns.push({
            id: `right-branch-${msgIndex}-${idx}`,
            type: 'right-branch',
            messageIndex: msgIndex, // Hangi satırda olduğunu bilmek için
            nodes: [{
              containerId: containerId,
              messageIndex: msgIndex,
              version: branch.version,
              contentPreview: branch.contentPreview
            }]
          });
        });
      }
    });

    return columns;
  }

  /**
   * Tüm unique mesaj index'lerini bul (sıralı)
   */
  getMessageIndices(messageAnalysis) {
    const indices = new Set();
    messageAnalysis.forEach(entry => {
      indices.add(entry.messageIndex);
    });
    return Array.from(indices).sort((a, b) => a - b);
  }
}

export default BranchTreeBuilder;
