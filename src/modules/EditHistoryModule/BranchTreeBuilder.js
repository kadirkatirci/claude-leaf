/**
 * BranchTreeBuilder - Snapshot'lardan branch map yapısı oluşturur
 * 
 * Mantık:
 * 1. Her snapshot bir "path" - o anki edited mesajların listesi
 * 2. Aynı mesaj numarası = aynı yatay hiza
 * 3. Devam eden path'ler aynı sütunda, yalnız kalanlar kendi sütununda
 * 4. Yalnız = O versiyondan sonra devam eden snapshot yok
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

    // 1. Snapshot'lardan path'leri çıkar
    const paths = this.extractPaths();
    console.log('[BranchTreeBuilder] Extracted paths:', paths);

    // 2. Sütunları oluştur
    const columns = this.buildColumns(paths);
    console.log('[BranchTreeBuilder] Built columns:', columns);

    // 3. Tüm unique mesaj numaralarını bul (yatay hiza için)
    const messageIndices = this.getUniqueMessageIndices(paths);
    console.log('[BranchTreeBuilder] Message indices:', messageIndices);

    // 4. History'den renk bilgisi için containerId'leri topla
    const containerIds = this.getUniqueContainerIds(paths);

    return {
      columns,
      messageIndices,
      containerIds,
      paths
    };
  }

  /**
   * Her snapshot'tan path çıkar
   * Path = [{ containerId, version, messageIndex, contentPreview }, ...]
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
   * Sütunları oluştur
   * Her sütun = bir path'in "benzersiz" kısmı
   */
  buildColumns(paths) {
    if (paths.length === 0) return [];

    const columns = [];
    
    // Path'leri string olarak temsil et (karşılaştırma için)
    const pathStrings = paths.map(p => 
      p.messages.map(m => `${m.containerId}:${m.version}`).join('|')
    );

    // Her path için: bu path başka bir path'in prefix'i mi?
    paths.forEach((path, index) => {
      const pathStr = pathStrings[index];
      
      // Bu path, başka bir path'in prefix'i mi kontrol et
      const isPrefix = pathStrings.some((otherStr, otherIndex) => {
        if (index === otherIndex) return false;
        // otherStr, pathStr ile başlıyor VE daha uzun mu?
        return otherStr.startsWith(pathStr) && otherStr.length > pathStr.length;
      });

      if (isPrefix) {
        // Bu path başka bir path'in prefix'i - sütun oluşturma
        // Ama son elemanı "yalnız" olarak işaretle
        const lastMessage = path.messages[path.messages.length - 1];
        
        // Bu mesajın devamı var mı kontrol et
        const hasExtension = paths.some((otherPath, otherIndex) => {
          if (index === otherIndex) return false;
          // Diğer path bu path'i içeriyor ve devamı var mı?
          const otherMessages = otherPath.messages;
          const thisMessages = path.messages;
          
          if (otherMessages.length <= thisMessages.length) return false;
          
          // İlk N eleman aynı mı?
          for (let i = 0; i < thisMessages.length; i++) {
            if (otherMessages[i].containerId !== thisMessages[i].containerId ||
                otherMessages[i].version !== thisMessages[i].version) {
              return false;
            }
          }
          return true;
        });

        if (!hasExtension) {
          // Devamı yok - yalnız sütun oluştur (sadece son eleman için)
          columns.push({
            id: `col-${index}-alone`,
            messages: [lastMessage],
            isAlone: true,
            snapshotId: path.snapshotId
          });
        }
        // hasExtension true ise bu path tamamen başka bir path içinde, sütun oluşturma
        
      } else {
        // Bu path başka bir path'in prefix'i değil
        // Ama bu path başka bir path'i prefix olarak içeriyor olabilir
        
        // En uzun ortak prefix'i bul
        let longestPrefixLength = 0;
        paths.forEach((otherPath, otherIndex) => {
          if (index === otherIndex) return;
          const commonLength = this.getCommonPrefixLength(path.messages, otherPath.messages);
          if (commonLength > longestPrefixLength && commonLength < path.messages.length) {
            longestPrefixLength = commonLength;
          }
        });

        // Prefix'ten sonraki kısım bu sütunun içeriği
        const columnMessages = longestPrefixLength > 0 
          ? path.messages.slice(longestPrefixLength)
          : path.messages;

        if (columnMessages.length > 0) {
          columns.push({
            id: `col-${index}`,
            messages: columnMessages,
            isAlone: false,
            snapshotId: path.snapshotId,
            prefixLength: longestPrefixLength
          });
        }
      }
    });

    // Sütunları sırala: önce alone olanlar (solda), sonra prefixLength'e göre
    columns.sort((a, b) => {
      // İlk mesajın messageIndex'ine göre sırala
      const aFirstIndex = a.messages[0]?.messageIndex || 0;
      const bFirstIndex = b.messages[0]?.messageIndex || 0;
      
      if (aFirstIndex !== bFirstIndex) {
        return aFirstIndex - bFirstIndex;
      }
      
      // Aynı messageIndex ise, alone olanlar önce
      if (a.isAlone && !b.isAlone) return -1;
      if (!a.isAlone && b.isAlone) return 1;
      
      // İkisi de alone veya ikisi de değil - mesaj sayısına göre
      return a.messages.length - b.messages.length;
    });

    return columns;
  }

  /**
   * İki mesaj listesinin ortak prefix uzunluğunu bul
   */
  getCommonPrefixLength(messages1, messages2) {
    let common = 0;
    const minLength = Math.min(messages1.length, messages2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (messages1[i].containerId === messages2[i].containerId &&
          messages1[i].version === messages2[i].version) {
        common++;
      } else {
        break;
      }
    }
    
    return common;
  }

  /**
   * Tüm unique mesaj index'lerini bul (sıralı)
   */
  getUniqueMessageIndices(paths) {
    const indices = new Set();
    paths.forEach(path => {
      path.messages.forEach(m => indices.add(m.messageIndex));
    });
    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Tüm unique containerId'leri bul
   */
  getUniqueContainerIds(paths) {
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
