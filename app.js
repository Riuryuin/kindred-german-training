const state = {
  sentences: [],
  filtered: [],
  index: 0,
  mediaRecorder: null,
  chunks: [],
  recordingBlob: null,
  recordingUrl: null
};

const $ = (id) => document.getElementById(id);

function setStatus(message) {
  $("status").textContent = message;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1];

    if (c === '"' && quoted && n === '"') {
      current += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === ',' && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    rows.push(parseCSVLine(line));
  }

  if (!rows.length) return [];

  const header = rows.shift();
  const idIndex = header.indexOf("id");
  const fileIndex = header.indexOf("file");
  const typeIndex = header.indexOf("type");
  const textIndex = header.indexOf("text");

  const map = new Map();

  for (const row of rows) {
    const id = row[idIndex] || "";
    const file = row[fileIndex] || "";
    const type = row[typeIndex] || "";
    const text = row[textIndex] || "";

    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, { id, file, original: "", ipa: "" });
    }

    const item = map.get(id);
    if (type === "original") item.original = text;
    if (type === "ipa") item.ipa = text;
  }

  return Array.from(map.values());
}

async function loadData() {
  try {
    const response = await fetch("sentences.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("sentences.csv를 불러오지 못했습니다.");
    const text = await response.text();

    state.sentences = parseCSV(text);
    state.filtered = [...state.sentences];

    if (!state.sentences.length) {
      throw new Error("문장이 없습니다.");
    }

    populateSelect();
    showSentence(0);
    setStatus("준비 완료");
  } catch (err) {
    console.error(err);
    setStatus("오류: " + err.message);
    $("original").textContent = "CSV를 불러오지 못했습니다.";
  }
}

function populateSelect() {
  const select = $("sentenceSelect");
  select.innerHTML = "";

  state.filtered.forEach((item, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `[${item.id}] ${item.original.slice(0, 35)}`;
    select.appendChild(option);
  });
}

function showSentence(i) {
  if (!state.filtered.length) {
    $("original").textContent = "검색 결과가 없습니다.";
    $("ipa").textContent = "—";
    $("counter").textContent = "0 / 0";
    $("playOriginal").disabled = true;
    return;
  }

  state.index = Math.max(0, Math.min(i, state.filtered.length - 1));
  const item = state.filtered[state.index];

  $("original").textContent = item.original;
  $("ipa").textContent = item.ipa;
  $("counter").textContent = `${state.index + 1} / ${state.filtered.length}`;
  $("sentenceSelect").value = state.index;
  $("playOriginal").disabled = false;

  clearMyRecording();
}

function playOriginal() {
  const item = state.filtered[state.index];
  if (!item) return;

  const audio = $("audio");
  
  // 파일 이름만 깔끔하게 추출 (예: '001.wav')
  let fileName = item.file;
  if (fileName.includes("/")) {
    fileName = fileName.substring(fileName.lastIndexOf("/") + 1);
  }

  // GitHub Pages 하위 경로 및 루트 경로 모두 안전하게 매칭되도록 절대 경로 조합
  const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
  const filePath = window.location.origin + basePath + "audio/" + fileName;

  audio.src = filePath;
  audio.currentTime = 0;
  audio.play().catch(err => {
    setStatus("원본 재생을 시작하지 못했습니다: " + err.message);
  });
}

function clearMyRecording() {
  if (state.recordingUrl) {
    URL.revokeObjectURL(state.recordingUrl);
  }
  state.recordingBlob = null;
  state.recordingUrl = null;
  $("playMine").disabled = true;
  $("downloadMine").classList.add("disabled");
  $("downloadMine").removeAttribute("href");
}

async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("이 브라우저에서는 마이크 녹음을 사용할 수 없습니다.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const preferred = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm"
    ];

    let mimeType = "";
    for (const type of preferred) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    state.chunks = [];
    state.mediaRecorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) state.chunks.push(e.data);
    };

    state.mediaRecorder.onstop = () => {
      const type = state.mediaRecorder.mimeType || "audio/webm";
      state.recordingBlob = new Blob(state.chunks, { type });
      state.recordingUrl = URL.createObjectURL(state.recordingBlob);

      $("playMine").disabled = false;
      $("downloadMine").classList.remove("disabled");
      $("downloadMine").href = state.recordingUrl;

      const ext = type.includes("mp4") ? "m4a" : "webm";
      const id = state.filtered[state.index]?.id || "recording";
      $("downloadMine").download = `${id}_my.${ext}`;

      setStatus("녹음 완료");
      stream.getTracks().forEach(track => track.stop());
    };

    state.mediaRecorder.start();
    $("record").disabled = true;
    $("stop").disabled = false;
    setStatus("● 녹음 중...");

  } catch (err) {
    setStatus("마이크 권한 또는 녹음 오류: " + err.message);
  }
}

function stopRecording() {
  if (state.mediaRecorder &&
      state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }

  $("record").disabled = false;
  $("stop").disabled = true;
}

function playMine() {
  if (!state.recordingUrl) return;
  const audio = $("audio");
  audio.src = state.recordingUrl;
  audio.currentTime = 0;
  audio.play();
}

function move(delta) {
  if (!state.filtered.length) return;
  showSentence(state.index + delta);
}

function search() {
  const q = $("search").value.trim().toLowerCase();

  state.filtered = state.sentences.filter(item =>
    item.id.toLowerCase().includes(q) ||
    item.original.toLowerCase().includes(q) ||
    item.ipa.toLowerCase().includes(q)
  );

  populateSelect();
  showSentence(0);
}

$("playOriginal").addEventListener("click", playOriginal);
$("record").addEventListener("click", startRecording);
$("stop").addEventListener("click", stopRecording);
$("playMine").addEventListener("click", playMine);
$("prev").addEventListener("click", () => move(-1));
$("next").addEventListener("click", () => move(1));
$("sentenceSelect").addEventListener("change", (e) => {
  showSentence(Number(e.target.value));
});
$("search").addEventListener("input", search);

// 앱 초기화 실행 (중복 호출 제거 완료)
loadData();
