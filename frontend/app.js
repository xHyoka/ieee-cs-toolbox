(function () {
'use strict';
// NOT: api.js ile aynı isimli global const'lar (api, DAYS_OF_WEEK, safeStorage...) çakıştığı için
// tüm dosya kendi kapsamına alındı.
/**
 * CS Araç Kutusu (CS Toolbox) - Ana Uygulama Mantığı (App Logic)
 * Vanilla JavaScript (ES6+), DOM Manipülasyonu, Durum Yönetimi ve Etkileşimler
 * 
 * Doğrudan çift tıklayarak tarayıcıda (file://) veya VS Code Live Server ile
 * sıfır bağımlılıkla ve CORS engeline takılmadan çalışır.
 */

// Global API Servisi ve Sabitlerini Çek
const CS_API_OBJ = window.CS_API || {};
const api = CS_API_OBJ.api;
const DAYS_OF_WEEK = CS_API_OBJ.DAYS_OF_WEEK || ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TIME_SLOTS = CS_API_OBJ.TIME_SLOTS || [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];
const SAMPLE_STUDENTS = CS_API_OBJ.SAMPLE_STUDENTS || [
  'Ahmet Yılmaz', 'Zeynep Kaya', 'Mehmet Demir', 'Elif Çelik',
  'Caner Aydın', 'Selin Öztürk', 'Burak Şahin', 'Büşra Yıldız'
];

// Güvenli depolama referansı
const safeStorage = CS_API_OBJ.safeStorage || {
  getItem: (k) => { try { return localStorage.getItem(k); } catch(e) { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, String(v)); } catch(e) {} },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch(e) {} }
};

// ============================================================================
// UYGULAMA DURUMU (APP STATE)
// ============================================================================
const state = {
  currentTab: 'groups',
  groupSize: 2,
  preventRepeats: true,
  lastGeneratedGroups: null,
  
  // Müsaitlik Durumu
  schedulerMode: 'heatmap', // 'heatmap' veya 'personal'
  userSlots: new Set(),
  isMouseDown: false,
  isSelecting: true,
  currentRespondentName: safeStorage.getItem('cs_last_user_name') || '',

  // Soru Kutusu Durumu
  questionCategory: 'all',
  questionSort: 'popular',

  // Fikir Panosu Durumu
  ideaCategory: 'all',
  ideaSort: 'votes'
};

// ============================================================================
// BİLDİRİM SİSTEMİ (TOAST NOTIFICATIONS)
// ============================================================================
function showToast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

// Güvenli HTML Kaçırma Yardımcısı
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/["]/g, '&quot;')
    .replace(/[']/g, '&#039;');
}

// Güvenli Pano Kopyalama (file:/// ve http protokollerinde kesintisiz çalışır)
function copyTextToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(successMsg, 'success'))
      .catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, 'success');
  } catch (err) {
    showToast('Panoya kopyalama başarısız oldu.', 'error');
  }
  document.body.removeChild(ta);
}

// Göreceli Zaman Formatlayıcı (Doğal Türkçe)
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const now = new Date();
  const date = new Date(isoString);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Az önce';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// ============================================================================
// NAVİGASYON & TAB YÖNETİMİ
// ============================================================================
const tabInfo = {
  groups: {
    title: 'Grup Eşleştirici',
    subtitle: 'Kulüp projeleri ve etkinlikler için dengeli ve adil takım oluşturma aracı'
  },
  availability: {
    title: 'Müsaitlik Planlayıcı',
    subtitle: 'Kulüp toplantıları ve çalışma saatleri için ortak boş vakit haritası'
  },
  questions: {
    title: 'Anonim Soru Kutusu',
    subtitle: 'Yönetim kuruluna, atölye liderlerine veya topluluğa çekinmeden soru sor'
  },
  ideas: {
    title: 'Fikir Oylama Panosu',
    subtitle: 'Topluluk üyelerinin etkinlik ve proje önerilerini puanla ve takip et'
  }
};

/**
 * Sekme Değiştirme Fonksiyonu
 * Hem buton click dinleyicilerinden hem doğrudan HTML onclick="switchTab('...')" üzerinden çağrılabilir.
 */
function switchTab(tabId) {
  if (!tabInfo[tabId]) return;
  state.currentTab = tabId;

  const navButtons = document.querySelectorAll('.sidebar-nav .nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const titleEl = document.getElementById('current-tab-title');
  const subtitleEl = document.getElementById('current-tab-subtitle');
  const sidebar = document.getElementById('sidebar');

  // Nav butonlarının aktiflik durumunu güncelle
  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Sekme görünürlüklerini güncelle
  tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Üst bar başlığını güncelle
  if (titleEl) {
    const span = titleEl.querySelector('span');
    if (span) span.textContent = tabInfo[tabId].title;
    else titleEl.textContent = tabInfo[tabId].title;
  }
  if (subtitleEl) {
    subtitleEl.textContent = tabInfo[tabId].subtitle;
  }

  // Mobil menü açıksa kapat
  if (sidebar) {
    sidebar.classList.remove('mobile-open');
  }

  // İlgili modülün görünümünü tazele
  if (tabId === 'availability') {
    renderAvailabilityModule();
  } else if (tabId === 'questions') {
    loadQuestions();
  } else if (tabId === 'ideas') {
    loadIdeas();
  } else if (tabId === 'groups') {
    updateGroupHistoryBadge();
  }
}

// Global scope'a bağla
window.switchTab = switchTab;

function initNavigation() {
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');

  // Event Delegation ile tüm nav butonlarına tıklamayı garantiye al
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (btn && btn.dataset && btn.dataset.tab) {
      e.preventDefault();
      switchTab(btn.dataset.tab);
    }
  });

  // Mobil hamburger menü
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
    });

    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && e.target !== mobileToggle) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }

  // Mod Durum Göstergesi
  if (api && typeof api.isMock === 'function') {
    const isMock = api.isMock();
    const statusDot = document.getElementById('status-dot');
    const modeText = document.getElementById('mode-text');
    const modeDetail = document.getElementById('mode-detail');

    if (!isMock) {
      if (statusDot) statusDot.className = 'status-dot backend';
      if (modeText) modeText.textContent = 'Spring Boot Bağlı';
      if (modeDetail) modeDetail.textContent = 'Tüm istekler canlı REST API endpointlerine (localhost:8080) iletilmektedir.';
    }
  }
}

// ============================================================================
// MODÜL 1: GRUP EŞLEŞTİRİCİ (GROUP MATCHER)
// ============================================================================
function initGroupMatcher() {
  const namesInput = document.getElementById('group-names-input');
  const countBadge = document.getElementById('participant-count-badge');
  const fillSampleBtn = document.getElementById('btn-fill-sample-names');
  const shuffleBtn = document.getElementById('btn-shuffle-input');
  const clearBtn = document.getElementById('btn-clear-names');
  const sizeBtns = document.querySelectorAll('#group-size-selector .segmented-btn');
  const preventRepeatsToggle = document.getElementById('toggle-prevent-repeats');
  const generateBtn = document.getElementById('btn-generate-groups');
  const copyAllBtn = document.getElementById('btn-copy-all-groups');
  const downloadBtn = document.getElementById('btn-download-groups');
  const resetHistoryBtn = document.getElementById('btn-reset-history');

  function parseNames() {
    if (!namesInput) return [];
    const raw = namesInput.value || '';
    const items = raw
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    return Array.from(new Set(items));
  }

  function updateParticipantCounter() {
    if (!countBadge) return;
    const names = parseNames();
    countBadge.textContent = `${names.length} Katılımcı`;
    countBadge.style.color = names.length >= 2 ? 'var(--cyan-400)' : 'var(--text-dim)';
  }

  if (namesInput) {
    namesInput.addEventListener('input', updateParticipantCounter);
  }

  if (fillSampleBtn && namesInput) {
    fillSampleBtn.addEventListener('click', () => {
      namesInput.value = SAMPLE_STUDENTS.join('\n');
      updateParticipantCounter();
      showToast('Örnek 16 kulüp üyesi listeye eklendi.', 'success');
    });
  }

  if (shuffleBtn && namesInput) {
    shuffleBtn.addEventListener('click', () => {
      const names = parseNames();
      if (names.length < 2) {
        showToast('Karıştırmak için en az 2 isim girmelisiniz.', 'warning');
        return;
      }
      for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
      }
      namesInput.value = names.join('\n');
      showToast('Katılımcı listesi karıştırıldı.', 'info');
    });
  }

  if (clearBtn && namesInput) {
    clearBtn.addEventListener('click', () => {
      namesInput.value = '';
      updateParticipantCounter();
    });
  }

  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.groupSize = parseInt(btn.dataset.size, 10);
    });
  });

  if (preventRepeatsToggle) {
    preventRepeatsToggle.addEventListener('change', () => {
      state.preventRepeats = preventRepeatsToggle.checked;
    });
  }

  if (resetHistoryBtn) {
    resetHistoryBtn.addEventListener('click', async () => {
      try {
        if (api && api.resetGroupHistory) {
          await api.resetGroupHistory();
        }
        updateGroupHistoryBadge();
        showToast('Geçmiş eşleşme hafızası başarıyla temizlendi.', 'success');
      } catch (err) {
        showToast(err.message || 'Sıfırlama başarısız.', 'error');
      }
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const names = parseNames();
      if (names.length < 2) {
        showToast('Lütfen en az 2 katılımcı ismi girin.', 'warning');
        if (namesInput) namesInput.focus();
        return;
      }

      const originalBtnHtml = generateBtn.innerHTML;
      generateBtn.disabled = true;
      generateBtn.innerHTML = `
        <span class="spinner"></span>
        <span>Gruplar Oluşturuluyor...</span>
      `;

      try {
        const result = await api.matchGroups({
          names,
          groupSize: state.groupSize,
          preventRepeats: state.preventRepeats
        });

        state.lastGeneratedGroups = result;
        renderGroupResults(result);
        updateGroupHistoryBadge();
        showToast(`${result.totalGroups} adet grup başarıyla oluşturuldu!`, 'success');
      } catch (err) {
        showToast(err.message || 'Grup oluşturma sırasında hata oluştu.', 'error');
      } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => {
      if (!state.lastGeneratedGroups || !state.lastGeneratedGroups.groups) return;
      const formattedText = formatGroupsForClipboard(state.lastGeneratedGroups);
      copyTextToClipboard(formattedText, 'Tüm gruplar panoya kopyalandı! (Discord/WhatsApp için hazır)');
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!state.lastGeneratedGroups || !state.lastGeneratedGroups.groups) return;
      const formattedText = formatGroupsForClipboard(state.lastGeneratedGroups);
      const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cs_gruplar_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Grup listesi .txt dosyası olarak indirildi.', 'info');
    });
  }

  updateGroupHistoryBadge();
}

function updateGroupHistoryBadge() {
  if (!api || !api.getGroupHistoryStats) return;
  const stats = api.getGroupHistoryStats();
  const badge = document.getElementById('group-history-count');
  if (badge) badge.textContent = stats.pairsCount;
}

function formatGroupsForClipboard(data) {
  const dateStr = new Date().toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  let text = `🚀 CS Araç Kutusu - Grup Eşleştirme Sonuçları\n`;
  text += `📅 Tarih: ${dateStr}\n`;
  text += `👥 Toplam: ${data.totalParticipants} Katılımcı | ${data.totalGroups} Grup\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  data.groups.forEach(g => {
    text += `📌 Grup ${g.groupId} (${g.members.length} Kişi):\n`;
    g.members.forEach(m => {
      text += `  • ${m}\n`;
    });
    text += `\n`;
  });

  text += `IEEE Computer Society Öğrenci Kulübü`;
  return text;
}

function renderGroupResults(data) {
  const container = document.getElementById('groups-container');
  const emptyState = document.getElementById('groups-empty-state');
  const statsHeader = document.getElementById('groups-stats-header');
  const copyAllBtn = document.getElementById('btn-copy-all-groups');
  const downloadBtn = document.getElementById('btn-download-groups');
  const subtitleEl = document.getElementById('groups-result-subtitle');

  if (emptyState) emptyState.style.display = 'none';
  if (statsHeader) statsHeader.style.display = 'flex';
  if (copyAllBtn) copyAllBtn.style.display = 'inline-flex';
  if (downloadBtn) downloadBtn.style.display = 'inline-flex';

  const totalGroupsEl = document.getElementById('stat-total-groups');
  const totalPartsEl = document.getElementById('stat-total-participants');
  if (totalGroupsEl) totalGroupsEl.textContent = data.totalGroups;
  if (totalPartsEl) totalPartsEl.textContent = data.totalParticipants;
  
  const conflictEl = document.getElementById('stat-conflict-penalty');
  if (conflictEl) {
    if (data.repeatConflictPenalty !== null) {
      if (data.repeatConflictPenalty === 0) {
        conflictEl.textContent = '0 (Sıfır Çakışma ✨)';
        conflictEl.style.color = 'var(--emerald-400)';
      } else {
        conflictEl.textContent = `${data.repeatConflictPenalty} (Minimizasyon Yapıldı)`;
        conflictEl.style.color = 'var(--orange-400)';
      }
    } else {
      conflictEl.textContent = 'Kapalı';
      conflictEl.style.color = 'var(--text-dim)';
    }
  }

  if (subtitleEl) {
    subtitleEl.textContent = `Toplam ${data.totalGroups} grup hazırlandı (${new Date().toLocaleTimeString('tr-TR')})`;
  }

  if (!container) return;
  container.innerHTML = '';

  data.groups.forEach((group, index) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const isOrange = index % 2 === 1;

    let membersHtml = '';
    group.members.forEach(member => {
      const initials = member.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      membersHtml += `
        <div class="member-chip">
          <div class="member-avatar">${escapeHtml(initials)}</div>
          <span class="member-name">${escapeHtml(member)}</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="group-card-header">
        <div class="group-title-badge">
          <div class="group-icon ${isOrange ? 'orange' : ''}">${group.groupId}</div>
          <div>
            <div class="group-name">Grup ${group.groupId}</div>
            <div class="group-member-count">${group.members.length} Üye</div>
          </div>
        </div>
        <button class="group-copy-btn" title="Yalnızca Bu Grubu Kopyala" data-group-id="${group.groupId}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      <div class="group-members-list">
        ${membersHtml}
      </div>
    `;

    const copyBtn = card.querySelector('.group-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const groupText = `📌 Grup ${group.groupId}:\n` + group.members.map(m => `• ${m}`).join('\n');
        copyTextToClipboard(groupText, `Grup ${group.groupId} panoya kopyalandı!`);
      });
    }

    container.appendChild(card);
  });
}

// ============================================================================
// MODÜL 2: MÜSAİTLİK PLANLAYICI (AVAILABILITY SCHEDULER)
// ============================================================================
function initAvailabilityScheduler() {
  const modeBtns = document.querySelectorAll('#scheduler-mode-selector .segmented-btn');
  const personalGroup = document.getElementById('personal-name-group');
  const studentNameInput = document.getElementById('student-name-input');
  const saveAvailabilityBtn = document.getElementById('btn-save-availability');
  const clearSlotsBtn = document.getElementById('btn-clear-my-slots');

  if (state.currentRespondentName && studentNameInput) {
    studentNameInput.value = state.currentRespondentName;
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.schedulerMode = btn.dataset.mode;

      if (state.schedulerMode === 'personal') {
        if (personalGroup) personalGroup.style.display = 'inline-flex';
        const legend = document.getElementById('heatmap-legend');
        if (legend) legend.style.display = 'none';
        showToast('Saatlerinizi seçmek için tablodaki kutulara tıklayın veya sürükleyin.', 'info');
      } else {
        if (personalGroup) personalGroup.style.display = 'none';
        const legend = document.getElementById('heatmap-legend');
        if (legend) legend.style.display = 'flex';
      }
      renderAvailabilityModule();
    });
  });

  if (saveAvailabilityBtn) {
    saveAvailabilityBtn.addEventListener('click', async () => {
      const name = studentNameInput ? studentNameInput.value.trim() : '';
      if (!name) {
        showToast('Lütfen adınızı ve soyadınızı yazın.', 'warning');
        if (studentNameInput) studentNameInput.focus();
        return;
      }
      if (state.userSlots.size === 0) {
        showToast('Lütfen en az 1 saat dilimi seçin.', 'warning');
        return;
      }

      safeStorage.setItem('cs_last_user_name', name);
      state.currentRespondentName = name;

      const originalHtml = saveAvailabilityBtn.innerHTML;
      saveAvailabilityBtn.disabled = true;
      saveAvailabilityBtn.innerHTML = `<span class="spinner"></span> Kaydediliyor...`;

      try {
        await api.submitAvailability({
          name,
          slots: Array.from(state.userSlots)
        });

        showToast(`Müsaitlik saatleriniz kaydedildi, teşekkürler ${name}!`, 'success');
        
        modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === 'heatmap'));
        state.schedulerMode = 'heatmap';
        if (personalGroup) personalGroup.style.display = 'none';
        const legend = document.getElementById('heatmap-legend');
        if (legend) legend.style.display = 'flex';
        
        renderAvailabilityModule();
      } catch (err) {
        showToast(err.message || 'Kayıt sırasında hata oluştu.', 'error');
      } finally {
        saveAvailabilityBtn.disabled = false;
        saveAvailabilityBtn.innerHTML = originalHtml;
      }
    });
  }

  if (clearSlotsBtn) {
    clearSlotsBtn.addEventListener('click', () => {
      state.userSlots.clear();
      renderAvailabilityGrid(null);
      showToast('Seçimleriniz temizlendi.', 'info');
    });
  }

  document.addEventListener('mouseup', () => {
    state.isMouseDown = false;
  });
}

async function renderAvailabilityModule() {
  try {
    if (!api || !api.getAvailabilitySummary) return;
    const summary = await api.getAvailabilitySummary();
    renderTopSlots(summary.topSlots, summary.totalRespondents);
    renderAvailabilityGrid(summary);
  } catch (err) {
    console.error('Müsaitlik yüklenirken hata:', err);
  }
}

function renderTopSlots(topSlots, totalRespondents) {
  const container = document.getElementById('top-slots-container');
  const countBadge = document.getElementById('availability-total-respondents');

  if (countBadge) {
    countBadge.textContent = `${totalRespondents} Kulüp Üyesi Yanıtladı`;
  }

  if (!container) return;

  if (!topSlots || topSlots.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); background: rgba(15,23,42,0.5); border-radius: 12px; border: 1px solid var(--border-subtle);">
        Henüz yeterli müsaitlik verisi girilmedi. "Kendi Saatlerimi Seç" butonuna tıklayarak ilk müsaitliğinizi ekleyebilirsiniz!
      </div>
    `;
    return;
  }

  const medals = ['🥇 1. Tercih', '🥈 2. Tercih', '🥉 3. Tercih'];

  container.innerHTML = topSlots.map((slot, index) => {
    const rankClass = `rank-${index + 1}`;
    const medalLabel = medals[index] || `#${index + 1} Tercih`;
    const namesList = slot.names.slice(0, 4).join(', ') + (slot.names.length > 4 ? ` ve ${slot.names.length - 4} kişi daha` : '');
    const startH = parseInt(slot.time, 10);
    const endH = (startH + 1).toString().padStart(2, '0') + ':00';

    return `
      <div class="top-slot-card ${rankClass}">
        <div class="top-slot-header">
          <span class="rank-pill">${medalLabel}</span>
          <span style="font-size: 0.82rem; font-weight: 700; color: var(--cyan-400);">%${slot.percentage} Katılım</span>
        </div>
        <div>
          <div class="slot-time-title">${slot.day}, ${slot.time} - ${endH}</div>
          <div class="slot-day-subtitle">${slot.count} / ${totalRespondents} kişi müsait</div>
        </div>
        <div class="slot-progress-wrap">
          <div class="slot-progress-bar" style="width: ${slot.percentage}%;"></div>
        </div>
        <div class="slot-attendees-text">
          <span title="${slot.names.join(', ')}">👥 ${escapeHtml(namesList)}</span>
          <button class="btn-text-action" style="padding: 2px 6px; font-size: 0.72rem;" onclick="copyMeetingSlot('${slot.day} ${slot.time}')">
            Kopyala
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.copyMeetingSlot = function(slotStr) {
  copyTextToClipboard(`📅 Toplantı Önerisi: ${slotStr} (CS Kulübü Ortak Müsait Zaman Dilimi)`, `"${slotStr}" toplantı notu kopyalandı!`);
};

function renderAvailabilityGrid(summary) {
  const tbody = document.getElementById('scheduler-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  const slotMap = summary ? summary.slotMap : {};

  TIME_SLOTS.forEach(time => {
    const tr = document.createElement('tr');
    
    const timeTd = document.createElement('td');
    timeTd.className = 'time-col';
    timeTd.textContent = `${time}`;
    tr.appendChild(timeTd);

    DAYS_OF_WEEK.forEach(day => {
      const td = document.createElement('td');
      const slotKey = `${day}-${time}`;
      const cell = document.createElement('div');
      cell.className = 'slot-cell';
      cell.dataset.key = slotKey;

      if (state.schedulerMode === 'heatmap') {
        const data = slotMap[slotKey] || { count: 0, names: [] };
        const count = data.count;

        let heatLevel = 0;
        if (count >= 8) heatLevel = 5;
        else if (count >= 6) heatLevel = 4;
        else if (count >= 4) heatLevel = 3;
        else if (count >= 2) heatLevel = 2;
        else if (count >= 1) heatLevel = 1;

        cell.dataset.heat = heatLevel;
        cell.textContent = count > 0 ? `${count}` : '-';

        if (count > 0) {
          const namesStr = data.names.join(', ');
          cell.title = `${day} ${time}\n${count} Kişi Müsait:\n${namesStr}`;
        } else {
          cell.title = `${day} ${time} (Henüz kayıt yok)`;
        }

        cell.addEventListener('click', () => {
          if (count > 0) {
            showToast(`${day} ${time}: ${data.names.join(', ')}`, 'info', 4000);
          } else {
            showToast(`${day} ${time} saatinde henüz müsait üye yok.`, 'info', 2000);
          }
        });

      } else {
        const isSelected = state.userSlots.has(slotKey);
        if (isSelected) {
          cell.classList.add('user-selected');
          cell.textContent = '✓';
        } else {
          cell.textContent = '';
        }

        cell.title = `Tıklayarak seç / kaldır (${day} ${time})`;

        cell.addEventListener('mousedown', (e) => {
          e.preventDefault();
          state.isMouseDown = true;
          if (state.userSlots.has(slotKey)) {
            state.userSlots.delete(slotKey);
            state.isSelecting = false;
            cell.classList.remove('user-selected');
            cell.textContent = '';
          } else {
            state.userSlots.add(slotKey);
            state.isSelecting = true;
            cell.classList.add('user-selected');
            cell.textContent = '✓';
          }
        });

        cell.addEventListener('mouseenter', () => {
          if (state.isMouseDown) {
            if (state.isSelecting) {
              state.userSlots.add(slotKey);
              cell.classList.add('user-selected');
              cell.textContent = '✓';
            } else {
              state.userSlots.delete(slotKey);
              cell.classList.remove('user-selected');
              cell.textContent = '';
            }
          }
        });
      }

      td.appendChild(cell);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ============================================================================
// MODÜL 3: ANONİM SORU KUTUSU (ANONYMOUS Q&A BOX)
// ============================================================================
function initQuestionBox() {
  const form = document.getElementById('question-form');
  const textarea = document.getElementById('question-text');
  const charCount = document.getElementById('question-char-count');
  const categorySelect = document.getElementById('question-category');
  const filterChips = document.querySelectorAll('#question-category-filter .cat-chip');
  const sortSelect = document.getElementById('question-sort-select');

  if (textarea && charCount) {
    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = textarea ? textarea.value.trim() : '';
      const category = categorySelect ? categorySelect.value : 'Genel';

      if (!text) {
        showToast('Lütfen sorunuzu yazın.', 'warning');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-question');
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Gönderiliyor...`;
      }

      try {
        await api.submitQuestion({ text, category });
        if (textarea) textarea.value = '';
        if (charCount) charCount.textContent = '0';
        showToast('Sorunuz anonim olarak başarıyla paylaşıldı!', 'success');
        loadQuestions();
      } catch (err) {
        showToast(err.message || 'Soru gönderilemedi.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.questionCategory = chip.dataset.category;
      loadQuestions();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.questionSort = sortSelect.value;
      loadQuestions();
    });
  }
}

async function loadQuestions() {
  const feed = document.getElementById('questions-feed-container');
  const sidebarBadge = document.getElementById('sidebar-question-badge');
  if (!feed || !api || !api.getQuestions) return;

  try {
    const questions = await api.getQuestions(state.questionCategory, state.questionSort);
    const userVotes = api.getUserVotes();

    if (sidebarBadge) {
      sidebarBadge.textContent = questions.length;
    }

    if (questions.length === 0) {
      feed.innerHTML = `
        <div class="empty-state" style="padding: 36px 20px;">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h4>Henüz Soru Yok</h4>
          <p>Bu kategoride soru bulunmuyor. İlk soruyu sol taraftaki formdan sorabilirsiniz!</p>
        </div>
      `;
      return;
    }

    feed.innerHTML = questions.map(q => {
      const isVoted = userVotes.questions.includes(q.id);
      const catClass = (q.category || 'genel').toLowerCase();

      return `
        <div class="question-card" id="q-card-${q.id}">
          <div class="upvote-btn-wrap">
            <button class="upvote-btn ${isVoted ? 'voted' : ''}" data-qid="${q.id}" title="${isVoted ? 'Oyu Geri Al' : 'Yukarı Oyla (Upvote)'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
              <span class="upvote-count">${q.upvotes}</span>
            </button>
          </div>

          <div class="question-content">
            <div class="question-meta">
              <span class="category-tag ${catClass}">${escapeHtml(q.category)}</span>
              <span>•</span>
              <span>🔒 ${escapeHtml(q.author || 'Anonim Üye')}</span>
              <span>•</span>
              <span>🕒 ${formatRelativeTime(q.createdAt)}</span>
              ${q.status === 'Cevaplandı' ? `<span style="margin-left: auto; color: var(--emerald-400); font-weight: 700;">✓ Cevaplandı</span>` : ''}
            </div>

            <div class="question-text">
              ${escapeHtml(q.text)}
            </div>

            ${q.adminReply ? `
              <div class="admin-reply-box">
                <div class="admin-reply-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  <span>Yönetim Kurulu Yanıtı</span>
                </div>
                <div class="admin-reply-text">${escapeHtml(q.adminReply)}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    feed.querySelectorAll('.upvote-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qid = btn.dataset.qid;
        try {
          const res = await api.upvoteQuestion(qid);
          btn.classList.toggle('voted', res.isUpvoted);
          btn.querySelector('.upvote-count').textContent = res.question.upvotes;
          
          if (res.isUpvoted) {
            showToast('Soru beğenildi!', 'success', 1800);
          }
        } catch (err) {
          showToast(err.message || 'Oy kaydedilemedi.', 'error');
        }
      });
    });

  } catch (err) {
    console.error('Sorular getirilemedi:', err);
  }
}

// ============================================================================
// MODÜL 4: FİKİR OYLAMA PANOSU (EVENT IDEA VOTING BOARD)
// ============================================================================
function initIdeaVoting() {
  const form = document.getElementById('idea-form');
  const titleInput = document.getElementById('idea-title');
  const categorySelect = document.getElementById('idea-category');
  const descInput = document.getElementById('idea-description');
  const authorInput = document.getElementById('idea-author');
  const filterChips = document.querySelectorAll('#idea-category-filter .cat-chip');
  const sortSelect = document.getElementById('idea-sort-select');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = titleInput ? titleInput.value.trim() : '';
      const description = descInput ? descInput.value.trim() : '';
      const category = categorySelect ? categorySelect.value : 'Workshop';
      const author = authorInput ? authorInput.value.trim() : '';

      if (!title || !description) {
        showToast('Lütfen başlık ve açıklama alanlarını doldurun.', 'warning');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-idea');
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Fikir Paylaşılıyor...`;
      }

      try {
        await api.submitIdea({ title, description, category, author });
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (authorInput) authorInput.value = '';
        showToast('Fikriniz oylama panosuna eklendi!', 'success');
        loadIdeas();
      } catch (err) {
        showToast(err.message || 'Fikir eklenemedi.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.ideaCategory = chip.dataset.category;
      loadIdeas();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.ideaSort = sortSelect.value;
      loadIdeas();
    });
  }
}

async function loadIdeas() {
  const container = document.getElementById('ideas-ranked-container');
  if (!container || !api || !api.getIdeas) return;

  try {
    const ideas = await api.getIdeas(state.ideaCategory, state.ideaSort);
    const userVotes = api.getUserVotes();

    if (ideas.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 36px 20px;">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
            </svg>
          </div>
          <h4>Fikir Bulunamadı</h4>
          <p>Bu kategoride henüz bir fikir yok. Yeni bir etkinlik önerisinde bulunun!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = ideas.map((idea, index) => {
      const isVoted = userVotes.ideas.includes(idea.id);
      const rank = index + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : '';
      
      let statusClass = 'oylamada';
      if (idea.status === 'Onaylandı') statusClass = 'onaylandi';
      else if (idea.status === 'Planlama Aşamasında') statusClass = 'planlama';

      return `
        <div class="idea-card ${rankClass}" id="idea-${idea.id}">
          <div class="rank-badge-wrap">
            <div class="rank-number">${rank}</div>
            <span style="font-size: 0.68rem; color: var(--text-dim); font-weight: 700;">SIRA</span>
          </div>

          <div class="idea-content">
            <div class="idea-header">
              <div>
                <h4 class="idea-title">${escapeHtml(idea.title)}</h4>
                <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                  <span class="category-tag teknik">${escapeHtml(idea.category)}</span>
                  <span style="font-size: 0.74rem; color: var(--text-dim);">•</span>
                  <span style="font-size: 0.74rem; color: var(--text-dim);">${formatRelativeTime(idea.createdAt)}</span>
                </div>
              </div>
              <span class="idea-status-tag ${statusClass}">${escapeHtml(idea.status || 'Oylamada')}</span>
            </div>

            <div class="idea-desc">
              ${escapeHtml(idea.description)}
            </div>

            <div class="idea-footer">
              <div class="idea-author">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Öneren: <strong>${escapeHtml(idea.author || 'Kulüp Üyesi')}</strong></span>
              </div>

              <button class="idea-vote-btn ${isVoted ? 'voted' : ''}" data-ideaid="${idea.id}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="${isVoted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span class="vote-count">${idea.votes}</span>
                <span>${isVoted ? 'Desteklendi' : 'Destekle'}</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.idea-vote-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.ideaid;
        try {
          const res = await api.voteIdea(id);
          btn.classList.toggle('voted', res.isVoted);
          btn.querySelector('.vote-count').textContent = res.idea.votes;
          const spans = btn.querySelectorAll('span');
          if (spans.length > 1) {
            spans[1].textContent = res.isVoted ? 'Desteklendi' : 'Destekle';
          }
          
          if (res.isVoted) {
            showToast('Fikre destek verdiniz! 🎉', 'success', 1800);
          }
          setTimeout(loadIdeas, 600);
        } catch (err) {
          showToast(err.message || 'Oy verilemedi.', 'error');
        }
      });
    });

  } catch (err) {
    console.error('Fikirler getirilemedi:', err);
  }
}

// ============================================================================
// MODALLAR VE GENEL SIFIRLAMA
// ============================================================================
function initModals() {
  const apiModal = document.getElementById('api-modal');
  const btnOpenApi = document.getElementById('btn-open-api-modal');
  const btnCloseApi = document.getElementById('btn-close-api-modal');
  const btnGotIt = document.getElementById('btn-modal-got-it');

  const resetModal = document.getElementById('confirm-reset-modal');
  const btnResetAll = document.getElementById('btn-reset-all');
  const btnCloseReset = document.getElementById('btn-close-reset-modal');
  const btnCancelReset = document.getElementById('btn-cancel-reset');
  const btnConfirmReset = document.getElementById('btn-confirm-reset');

  if (btnOpenApi && apiModal) {
    btnOpenApi.addEventListener('click', () => apiModal.classList.add('active'));
    if (btnCloseApi) btnCloseApi.addEventListener('click', () => apiModal.classList.remove('active'));
    if (btnGotIt) btnGotIt.addEventListener('click', () => apiModal.classList.remove('active'));
    apiModal.addEventListener('click', (e) => {
      if (e.target === apiModal) apiModal.classList.remove('active');
    });
  }

  if (btnResetAll && resetModal) {
    btnResetAll.addEventListener('click', () => resetModal.classList.add('active'));
    if (btnCloseReset) btnCloseReset.addEventListener('click', () => resetModal.classList.remove('active'));
    if (btnCancelReset) btnCancelReset.addEventListener('click', () => resetModal.classList.remove('active'));
    resetModal.addEventListener('click', (e) => {
      if (e.target === resetModal) resetModal.classList.remove('active');
    });

    if (btnConfirmReset) {
      btnConfirmReset.addEventListener('click', async () => {
        try {
          await api.resetAllData();
          resetModal.classList.remove('active');
          showToast('Tüm mock verileri varsayılan ayarlara döndürüldü.', 'success');
          
          updateGroupHistoryBadge();
          renderAvailabilityModule();
          loadQuestions();
          loadIdeas();
        } catch (err) {
          showToast('Veriler sıfırlanırken hata oluştu.', 'error');
        }
      });
    }
  }
}

// ============================================================================
// GİRİŞ / KAYIT (AUTH)
// ============================================================================
function showAuthError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('show', !!message);
}

function applyLoggedInUi(user) {
  document.body.classList.remove('auth-locked');
  const label = document.getElementById('auth-user-label');
  if (label) {
    label.textContent = `👤 ${user.username}`;
    label.style.display = 'inline-flex';
  }
  // Müsaitlik formunda adı otomatik doldur (kullanıcı daha önce başka ad yazmadıysa)
  const nameInput = document.getElementById('student-name-input');
  if (nameInput && !nameInput.value) nameInput.value = user.username;

  renderAvailabilityModule();
  loadQuestions();
  loadIdeas();
  updateGroupHistoryBadge();
}

function applyLoggedOutUi() {
  document.body.classList.add('auth-locked');
  const label = document.getElementById('auth-user-label');
  if (label) label.style.display = 'none';
  showAuthError('login-error', '');
  showAuthError('register-error', '');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  if (loginForm) loginForm.style.display = '';
  if (registerForm) registerForm.style.display = 'none';
}

function initAuth() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegister = document.getElementById('link-show-register');
  const showLogin = document.getElementById('link-show-login');
  const logoutBtn = document.getElementById('btn-logout');

  function toggleForms(showRegisterForm) {
    if (loginForm) loginForm.style.display = showRegisterForm ? 'none' : '';
    if (registerForm) registerForm.style.display = showRegisterForm ? '' : 'none';
    showAuthError('login-error', '');
    showAuthError('register-error', '');
    const first = document.getElementById(showRegisterForm ? 'register-username' : 'login-username');
    if (first) first.focus();
  }

  if (showRegister) showRegister.addEventListener('click', (e) => { e.preventDefault(); toggleForms(true); });
  if (showLogin) showLogin.addEventListener('click', (e) => { e.preventDefault(); toggleForms(false); });

  async function submitAuth(form, btnId, errorId, loadingText, action) {
    const btn = document.getElementById(btnId);
    const original = btn.textContent;
    showAuthError(errorId, '');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    try {
      const user = await action();
      form.reset();
      applyLoggedInUi(user);
      showToast(`Hoş geldin, ${user.username}!`, 'success');
    } catch (err) {
      showAuthError(errorId, err.message || 'Bir hata oluştu.');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitAuth(loginForm, 'btn-login', 'login-error', 'Giriş yapılıyor...', () => api.login({
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value
      }));
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = document.getElementById('register-password').value;
      const password2 = document.getElementById('register-password2').value;
      if (password !== password2) {
        showAuthError('register-error', 'Şifreler eşleşmiyor.');
        return;
      }
      submitAuth(registerForm, 'btn-register', 'register-error', 'Hesap oluşturuluyor...', () => api.register({
        username: document.getElementById('register-username').value,
        password
      }));
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      api.logout();
      applyLoggedOutUi();
      switchTab('groups');
      showToast('Çıkış yapıldı.', 'info');
    });
  }

  // Sayfa açılışında oturum kontrolü
  const user = api && api.getCurrentUser ? api.getCurrentUser() : null;
  if (user && user.username) {
    applyLoggedInUi(user);
  } else {
    applyLoggedOutUi();
  }
}

// ============================================================================
// UYGULAMA BAŞLATICI (INITIALIZATION ENTRY POINT)
// ============================================================================
function startApp() {
  try {
    initNavigation();
    initGroupMatcher();
    initAvailabilityScheduler();
    initQuestionBox();
    initIdeaVoting();
    initModals();

    // Oturum kontrolü: giriş yapılmışsa uygulamayı aç ve verileri yükle
    initAuth();

    console.log('🚀 CS Araç Kutusu (CS Toolbox) başarıyla başlatıldı.');
  } catch (err) {
    console.error('Başlatma hatası:', err);
  }
}

// DOMContentLoaded yarışı olmaksızın anında güvenli başlatma
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

})();
