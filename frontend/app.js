// ===== AYARLAR =====
// Backend hazır olana kadar true kalsın: sahte (örnek) veriyle çalışır.
// Backend çalışınca false yap, istekler gerçek API'ye gider.
const USE_MOCK = true;
const API_URL = "http://localhost:8080/api/groupings";

// ===== SAYFA ELEMANLARI =====
const form = document.getElementById("groupForm");
const titleInput = document.getElementById("title");
const namesInput = document.getElementById("names");
const groupSizeSelect = document.getElementById("groupSize");
const submitBtn = document.getElementById("submitBtn");
const errorBox = document.getElementById("error");
const resultSection = document.getElementById("result");
const resultTitle = document.getElementById("resultTitle");
const groupsContainer = document.getElementById("groups");

// ===== FORM GÖNDERİLİNCE =====
form.addEventListener("submit", async (event) => {
  event.preventDefault(); // sayfanın yenilenmesini engeller
  hideError();

  // Textarea'daki isimleri satır satır ayır, boş satırları at
  const names = namesInput.value
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const requestBody = {
    title: titleInput.value.trim() || "İsimsiz Etkinlik",
    names: names,
    groupSize: Number(groupSizeSelect.value),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Oluşturuluyor...";

  try {
    const data = USE_MOCK
      ? await createGroupsMock(requestBody)
      : await createGroupsApi(requestBody);
    showGroups(data);
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Grupları Oluştur";
  }
});

// ===== GERÇEK API İSTEĞİ =====
async function createGroupsApi(body) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    // Backend hata durumunda { "message": "..." } döner
    throw new Error(data.message || "Bir hata oluştu");
  }
  return data;
}

// ===== SAHTE API (backend hazır olana kadar) =====
// Backend'in döneceği cevabın aynısını taklit eder.
async function createGroupsMock(body) {
  await new Promise((resolve) => setTimeout(resolve, 400)); // ağ gecikmesi taklidi

  if (body.names.length < 2) {
    throw new Error("En az 2 isim girilmeli");
  }

  // İsimleri karıştır
  const shuffled = [...body.names].sort(() => Math.random() - 0.5);

  // Gruplara böl
  const groups = [];
  for (let i = 0; i < shuffled.length; i += body.groupSize) {
    groups.push(shuffled.slice(i, i + body.groupSize));
  }

  // Son grup eksik kaldıysa, kişileri bir önceki gruba ekle
  const last = groups[groups.length - 1];
  if (groups.length > 1 && last.length < body.groupSize) {
    groups.pop();
    groups[groups.length - 1].push(...last);
  }

  return {
    id: "mock123",
    title: body.title,
    groupSize: body.groupSize,
    groups: groups,
  };
}

// ===== SONUÇLARI EKRANA BAS =====
function showGroups(data) {
  resultTitle.textContent = data.title;
  groupsContainer.innerHTML = "";

  data.groups.forEach((members, index) => {
    const card = document.createElement("div");
    card.className = "group-card";

    const heading = document.createElement("h3");
    heading.textContent = `Grup ${index + 1}`;
    card.appendChild(heading);

    const list = document.createElement("ul");
    members.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name; // textContent: isimlerdeki HTML çalıştırılmaz (güvenli)
      list.appendChild(item);
    });
    card.appendChild(list);

    groupsContainer.appendChild(card);
  });

  resultSection.hidden = false;
}

// ===== HATA GÖSTERME =====
function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  resultSection.hidden = true;
}

function hideError() {
  errorBox.hidden = true;
}
