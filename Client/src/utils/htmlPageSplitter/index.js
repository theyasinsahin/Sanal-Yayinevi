// Sayfa başına ortalama karakter limiti
// 950x680px bir alan için yaklaşık 1200-1400 karakter idealdir.
const MAX_CHARS_PER_PAGE = 1200; 

export const parseContentToPages = (htmlContent, chapterTitle) => {
  if (!htmlContent) return [];

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // ReactQuill veya editörden gelen children'lar (<p>, <h2>, <ul> vs.)
  const children = Array.from(tempDiv.children); 

  // Eğer düz metin geldiyse (tag yoksa) onu p içine alalım
  if (children.length === 0 && htmlContent.trim().length > 0) {
     const p = document.createElement('p');
     p.innerText = htmlContent;
     children.push(p);
  }

  const pages = [];
  
  // Şu anki sayfa için biriken HTML
  let currentPageContent = "";
  let currentLength = 0;
  let isFirstPageOfChapter = true;

  // Yeni sayfa oluşturup listeye atan yardımcı fonksiyon
  const pushPage = () => {
    if (currentPageContent.trim().length > 0) {
        pages.push({
            content: currentPageContent,
            isChapterStart: isFirstPageOfChapter,
            title: chapterTitle
        });
        // Sıfırla
        currentPageContent = "";
        currentLength = 0;
        isFirstPageOfChapter = false; // Artık bölüm başı değil
    }
  };

  children.forEach((node) => {
    const nodeHTML = node.outerHTML;
    const nodeTextLength = node.innerText.length;
    
    // SENARYO 1: Element tek başına sığıyorsa direkt ekle
    if (currentLength + nodeTextLength <= MAX_CHARS_PER_PAGE) {
        currentPageContent += nodeHTML;
        currentLength += nodeTextLength;
    } 
    // SENARYO 2: Element sığmıyor.
    else {
        // Alt Senaryo 2a: Sayfada zaten başka şeyler varsa önce onları gönderip yer açalım.
        if (currentLength > 0) {
            // Eğer element "tek başına bile" bir sayfadan büyük değilse, 
            // sadece yeni sayfaya geçmek yeterli olabilir.
            if (nodeTextLength <= MAX_CHARS_PER_PAGE) {
                pushPage();
                currentPageContent += nodeHTML;
                currentLength += nodeTextLength;
                return; 
            }
            // Aksi takdirde (dev paragraf ise) aşağıya devam et...
        }

        // SENARYO 3: DEV PARAGRAF PARÇALAMA (Chunking)
        // Element (node) tek bir sayfadan daha büyük! Onu kelime kelime bölmeliyiz.
        
        // 1. Tag ismini (p, div, h1) ve attributes'larını al (class vs kalsın diye)
        const tagName = node.tagName.toLowerCase();
        const attributes = Array.from(node.attributes)
            .map(attr => `${attr.name}="${attr.value}"`)
            .join(' ');
        
        const openingTag = `<${tagName} ${attributes}>`;
        const closingTag = `</${tagName}>`;

        // 2. İçeriği kelimelere böl
        const words = node.innerHTML.split(/\s+/); // Boşluktan böl
        
        let tempParagraph = ""; // Parça parça paragraf oluşturacağız
        
        words.forEach((word) => {
            const wordLen = word.length + 1; // +1 boşluk için
            
            // Kelimeyi eklersek sayfa taşar mı?
            if (currentLength + tempParagraph.length + wordLen > MAX_CHARS_PER_PAGE) {
                // Taşıyorsa:
                // 1. Şu anki birikmiş kelimeleri etiketle kapat (örn: <p>...kelimeler</p>)
                currentPageContent += `${openingTag}${tempParagraph}${closingTag}`;
                
                // 2. Sayfayı gönder
                pushPage();

                // 3. Yeni sayfa için tempParagraph'ı bu kelimeyle başlat
                tempParagraph = word + " ";
                // currentLength sıfırlandı (pushPage içinde), şimdi bu kelimeyi ekle
                currentLength = wordLen; 
            } else {
                // Taşmıyorsa kelimeyi ekle
                tempParagraph += word + " ";
            }
        });

        // Döngü bittiğinde elde kalan son parçayı şu anki sayfaya ekle
        if (tempParagraph.trim().length > 0) {
            currentPageContent += `${openingTag}${tempParagraph}${closingTag}`;
            currentLength += tempParagraph.length;
        }
    }
  });

  // Son kalanları itele
  pushPage();

  return pages;
};