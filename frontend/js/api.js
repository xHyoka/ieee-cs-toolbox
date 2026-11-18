/**
 * CS Araç Kutusu - API Katmanı (api.js)
 *
 * app.js ekranla ilgilenir, bu dosya veriyle.
 * - Grup Eşleştirici  -> GERÇEK backend (Spring Boot, localhost:8080)
 * - Diğer araçlar     -> şimdilik MOCK (tarayıcının localStorage'ı)
 *
 * Bir aracın backend'i hazır olduğunda sadece o aracın fonksiyonlarının içi
 * fetch ile değiştirilir; app.js'e dokunmaya gerek kalmaz.
 */
(function () {
  'use strict';

  // ==========================================================================
  // AYARLAR
  // ==========================================================================
  const API_BASE = 'http://localhost:8080';

  const KEYS = {
    users: 'cs_users',
    session: 'cs_session',
    groupHistory: 'cs_group_history',
    availability: 'cs_availability',
    questions: 'cs_questions',
    ideas: 'cs_ideas',
    votes: 'cs_votes'
  };

  const DAYS_OF_WEEK = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const TIME_SLOTS = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];
  const SAMPLE_STUDENTS = [
    'Ahmet Yılmaz', 'Zeynep Kaya', 'Mehmet Demir', 'Elif Çelik',
    'Caner Aydın', 'Selin Öztürk', 'Burak Şahin', 'Büşra Yıldız',
    'Emre Koç', 'Ayşe Arslan', 'Can Doğan', 'Deniz Kurt',
    'Ece Aksoy', 'Kaan Polat', 'Merve Güneş', 'Oğuz Erdem'
  ];

  // ==========================================================================
  // YARDIMCILAR
  // ==========================================================================
  const safeStorage = {
    getItem: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} },
    removeItem: (k) => { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function load(key, fallback) {
    const raw = safeStorage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function save(key, value) {
    safeStorage.setItem(key, JSON.stringify(value));
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Mock gecikmesi: gerçek bir sunucu gibi hissettirsin
  function delay(ms = 250) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function hoursAgo(h) {
    return new Date(Date.now() - h * 3600 * 1000).toISOString();
  }

  // Backend'e istek atan ortak fonksiyon
  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(API_BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
    } catch (e) {
      // Sunucu kapalıysa fetch hiç cevap alamaz
      throw new Error('Sunucuya ulaşılamadı. Backend (Spring Boot) çalışıyor mu?');
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* boş cevap */ }

    if (!res.ok) {
      throw new Error((data && data.message) || `Sunucu hatası (${res.status})`);
    }
    return data;
  }

  // ==========================================================================
  // BAŞLANGIÇ VERİLERİ (sadece mock araçlar için)
  // ==========================================================================
  function seedData() {
    if (!load(KEYS.questions, null)) {
      save(KEYS.questions, [
        {
          id: 'q1', text: 'Dönem içinde Spring Boot veya backend üzerine bir atölye yapılacak mı?',
          category: 'Teknik', author: 'Anonim Üye', createdAt: hoursAgo(5),
          upvotes: 7, status: 'Cevaplandı',
          adminReply: 'Evet, Aralık ayında başlangıç seviyesinde bir backend atölyesi planlıyoruz.'
        },
        {
          id: 'q2', text: 'Staj başvurularında CV için kulüp olarak destek verebilir misiniz?',
          category: 'Kariyer', author: 'Anonim Üye', createdAt: hoursAgo(26),
          upvotes: 4, status: 'Bekliyor', adminReply: null
        },
        {
          id: 'q3', text: 'Ideathon için takımlar nasıl oluşturulacak?',
          category: 'Etkinlik', author: 'Anonim Üye', createdAt: hoursAgo(50),
          upvotes: 2, status: 'Bekliyor', adminReply: null
        }
      ]);
    }

    if (!load(KEYS.ideas, null)) {
      save(KEYS.ideas, [
        {
          id: 'i1', title: '24 Saatlik Mini Hackathon',
          description: 'Dönem sonunda kampüste, küçük takımlarla tek günlük bir hackathon.',
          category: 'Hackathon', author: 'Kulüp Üyesi', createdAt: hoursAgo(30),
          votes: 9, status: 'Planlama Aşamasında'
        },
        {
          id: 'i2', title: 'Git & GitHub Atölyesi',
          description: 'Yeni üyeler için branch, pull request ve takım çalışması pratiği.',
          category: 'Workshop', author: 'Kulüp Üyesi', createdAt: hoursAgo(72),
          votes: 6, status: 'Oylamada'
        },
        {
          id: 'i3', title: 'Sektörden Mezun Söyleşisi',
          description: 'Yazılım sektöründe çalışan mezunlarla kariyer sohbeti.',
          category: 'Seminer', author: 'Kulüp Üyesi', createdAt: hoursAgo(120),
          votes: 3, status: 'Oylamada'
        }
      ]);
    }

    if (!load(KEYS.availability, null)) save(KEYS.availability, {});
    if (!load(KEYS.votes, null)) save(KEYS.votes, { questions: [], ideas: [] });
    if (!load(KEYS.groupHistory, null)) save(KEYS.groupHistory, []);
  }

  // ==========================================================================
  // API
  // ==========================================================================
  const api = {
    // Arayüzdeki "Spring Boot Bağlı" göstergesi için.
    // Şimdilik sadece grup eşleştirici bağlı olduğu için mock sayıyoruz.
    isMock() {
      return true;
    },

    // ------------------------------------------------------------------------
    // GRUP EŞLEŞTİRİCİ  ->  GERÇEK BACKEND
    // ------------------------------------------------------------------------
    async matchGroups({ names, groupSize, preventRepeats }) {
      const result = await request('/api/groupings', {
        method: 'POST',
        body: JSON.stringify({ names, groupSize, preventRepeats })
      });

      // Geçmiş sayacı için eşleşen ikilileri tarayıcıda tut (tekrar engelleme
      // backend'e eklenince bu kısım kalkacak)
      const history = load(KEYS.groupHistory, []);
      result.groups.forEach(g => {
        for (let i = 0; i < g.members.length; i++) {
          for (let j = i + 1; j < g.members.length; j++) {
            history.push([g.members[i], g.members[j]].sort().join('|'));
          }
        }
      });
      save(KEYS.groupHistory, Array.from(new Set(history)));

      return result;
    },

    getGroupHistoryStats() {
      return { pairsCount: load(KEYS.groupHistory, []).length };
    },

    async resetGroupHistory() {
      save(KEYS.groupHistory, []);
    },

    // ------------------------------------------------------------------------
    // GİRİŞ / KAYIT  ->  MOCK
    // Sadece arayüz denemesi içindir, gerçek bir güvenlik sağlamaz.
    // Gerçek şifreni burada kullanma.
    // ------------------------------------------------------------------------
    async register({ username, password }) {
      await delay();
      username = (username || '').trim();
      if (username.length < 3) throw new Error('Kullanıcı adı en az 3 karakter olmalı.');
      if (!password || password.length < 4) throw new Error('Şifre en az 4 karakter olmalı.');

      const users = load(KEYS.users, {});
      if (users[username.toLowerCase()]) throw new Error('Bu kullanıcı adı zaten alınmış.');

      users[username.toLowerCase()] = { username, password };
      save(KEYS.users, users);

      const user = { username };
      save(KEYS.session, user);
      return user;
    },

    async login({ username, password }) {
      await delay();
      username = (username || '').trim();
      const users = load(KEYS.users, {});
      const found = users[username.toLowerCase()];
      if (!found || found.password !== password) {
        throw new Error('Kullanıcı adı veya şifre hatalı.');
      }
      const user = { username: found.username };
      save(KEYS.session, user);
      return user;
    },

    logout() {
      safeStorage.removeItem(KEYS.session);
    },

    getCurrentUser() {
      return load(KEYS.session, null);
    },

    // ------------------------------------------------------------------------
    // MÜSAİTLİK PLANLAYICI  ->  MOCK
    // ------------------------------------------------------------------------
    async submitAvailability({ name, slots }) {
      await delay();
      const all = load(KEYS.availability, {});
      all[name] = slots;
      save(KEYS.availability, all);
    },

    async getAvailabilitySummary() {
      const all = load(KEYS.availability, {});
      const respondents = Object.keys(all);
      const total = respondents.length;

      const slotMap = {};
      respondents.forEach(name => {
        all[name].forEach(key => {
          if (!slotMap[key]) slotMap[key] = { count: 0, names: [] };
          slotMap[key].count++;
          slotMap[key].names.push(name);
        });
      });

      const topSlots = Object.entries(slotMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([key, data]) => {
          const [day, time] = key.split('-');
          return {
            day,
            time,
            count: data.count,
            names: data.names,
            percentage: Math.round((data.count / total) * 100)
          };
        });

      return { slotMap, topSlots, totalRespondents: total };
    },

    // ------------------------------------------------------------------------
    // ANONİM SORU KUTUSU  ->  MOCK
    // ------------------------------------------------------------------------
    async getQuestions(category = 'all', sort = 'popular') {
      await delay(150);
      let list = load(KEYS.questions, []);
      if (category !== 'all') list = list.filter(q => q.category === category);

      if (sort === 'newest') {
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else {
        list.sort((a, b) => b.upvotes - a.upvotes);
      }
      return list;
    },

    async submitQuestion({ text, category }) {
      await delay();
      text = (text || '').trim();
      if (text.length < 5) throw new Error('Soru en az 5 karakter olmalı.');

      const list = load(KEYS.questions, []);
      const question = {
        id: newId(), text, category: category || 'Genel',
        author: 'Anonim Üye', createdAt: new Date().toISOString(),
        upvotes: 0, status: 'Bekliyor', adminReply: null
      };
      list.push(question);
      save(KEYS.questions, list);
      return question;
    },

    async upvoteQuestion(id) {
      await delay(100);
      const list = load(KEYS.questions, []);
      const question = list.find(q => q.id === id);
      if (!question) throw new Error('Soru bulunamadı.');

      const votes = load(KEYS.votes, { questions: [], ideas: [] });
      const already = votes.questions.includes(id);

      if (already) {
        votes.questions = votes.questions.filter(v => v !== id);
        question.upvotes = Math.max(0, question.upvotes - 1);
      } else {
        votes.questions.push(id);
        question.upvotes++;
      }

      save(KEYS.votes, votes);
      save(KEYS.questions, list);
      return { isUpvoted: !already, question };
    },

    // ------------------------------------------------------------------------
    // FİKİR OYLAMA PANOSU  ->  MOCK
    // ------------------------------------------------------------------------
    async getIdeas(category = 'all', sort = 'votes') {
      await delay(150);
      let list = load(KEYS.ideas, []);
      if (category !== 'all') list = list.filter(i => i.category === category);

      if (sort === 'newest') {
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else {
        list.sort((a, b) => b.votes - a.votes);
      }
      return list;
    },

    async submitIdea({ title, description, category, author }) {
      await delay();
      const list = load(KEYS.ideas, []);
      const idea = {
        id: newId(),
        title: title.trim(),
        description: description.trim(),
        category: category || 'Workshop',
        author: (author || '').trim() || 'Kulüp Üyesi',
        createdAt: new Date().toISOString(),
        votes: 0,
        status: 'Oylamada'
      };
      list.push(idea);
      save(KEYS.ideas, list);
      return idea;
    },

    async voteIdea(id) {
      await delay(100);
      const list = load(KEYS.ideas, []);
      const idea = list.find(i => i.id === id);
      if (!idea) throw new Error('Fikir bulunamadı.');

      const votes = load(KEYS.votes, { questions: [], ideas: [] });
      const already = votes.ideas.includes(id);

      if (already) {
        votes.ideas = votes.ideas.filter(v => v !== id);
        idea.votes = Math.max(0, idea.votes - 1);
      } else {
        votes.ideas.push(id);
        idea.votes++;
      }

      save(KEYS.votes, votes);
      save(KEYS.ideas, list);
      return { isVoted: !already, idea };
    },

    // Bu tarayıcıda hangi soru/fikirlere oy verildi
    getUserVotes() {
      return load(KEYS.votes, { questions: [], ideas: [] });
    },

    // ------------------------------------------------------------------------
    // GENEL SIFIRLAMA (sadece mock veriler; oturum ve hesaplar kalır)
    // ------------------------------------------------------------------------
    async resetAllData() {
      [KEYS.groupHistory, KEYS.availability, KEYS.questions, KEYS.ideas, KEYS.votes]
        .forEach(k => safeStorage.removeItem(k));
      seedData();
    }
  };

  seedData();

  // app.js bunları window.CS_API üzerinden okur
  window.CS_API = { api, DAYS_OF_WEEK, TIME_SLOTS, SAMPLE_STUDENTS, safeStorage };
})();
