// --------- Global Variables ---------

//---- Can Change These ----
let comboBonusThreshold = 15;

let autorecord = false; // if you want to record automatically when starting a song

let winterAuto = true; // for holiday theme auto 

//---- Do Not Change These ----
let currentNotes = [];
let songData = null;
let startTime = null;
let animationId = null;
let score = 0;
let combo = 0;
let gameActive = false;


let theme = "main"; // default theme

let recording = false; // not where you change this
let recordedNotes = [];

let totalNotes = 0;
let missedNotes = 0;
let selectedDifficultyGlobal = null;
let songNameGlobal = null;
let activeNotes = [];       // DOM notes currently on screen (JS array)
let nextNoteIndex = 0;      // next note to spawn from songData.notes
let lastRuntimeUpdate = 0;  // throttle HUD runtime updates
let lastSpawnTime = {};    // per-key last spawn time for debouncing
let activeNotesByKey = { a: [], s: [], d: [], f: [], j: [], k: [], l: [] };

// Custom Cursor Variables
let mouseX = 0,
  mouseY = 0;
let cursorX = 0,
  cursorY = 0;

const cursor = document.querySelector('.custom-cursor');
const realcursor = document.querySelector('.realcustom-cursor');

// main.js — put this after LevelWidget.js and after the DOM elements above
document.addEventListener('DOMContentLoaded', () => {
  // enable shared persistence and set storage key (optional)
  LevelWidget.persist = true;
  LevelWidget.storageKey = 'game_level_shared_v1';

  // auto-init all .level-widget elements and keep array globally for convenience
  const widgets = LevelWidget.autoInit(); 
  window.levelWidgets = widgets;

  // listen for level-up events from any widget container and refresh UI

  // Example usage:
  // levelWidgets[0].addXP(120); // will update both widgets and trigger rank UI refresh on level up
});

// --------- Main Gameloop  ---------


function showSongInfo(songName) {
  
  const audio = document.getElementById("info-audio");
  const data = window[songName];
  let songRanks = JSON.parse(localStorage.getItem("songRanks") || "{}");
  const rank = songRanks[data.songName] || "D"; // Default to D if not found
  const extremeRank = songRanks['extreme '+ data.songName] || "D";
  let selectedDifficulty = null;
  
  function setDiffSelection(diff) {
    selectedDifficulty = diff;
    document.querySelectorAll('.diff-btn').forEach(btn => btn.classList.remove("selected"));
    if (diff) document.getElementById(`${diff}-button`).classList.add("selected");
    const bar = document.getElementById("difficulty-bar");
    let difficulty = data?.[selectedDifficulty + "Value"] || 0;

    // Check for extreme and adjust difficulty if necessary
    if (diff === "extreme" && !data.extremeValue) {
      const nextHighestDiff = ["hard", "normal", "easy"].find(d => data[`has${d.charAt(0).toUpperCase() + d.slice(1)}`]);
      difficulty = nextHighestDiff ? (data[nextHighestDiff + "Value"] || 0) + 20 : difficulty;
    }

    bar.style.width = `${difficulty}%`;

  }


  ["easy", "normal", "hard", "extreme"].forEach(diff => {
  const btn = document.getElementById(`${diff}-button`);
  const hasChart = data[`has${diff.charAt(0).toUpperCase() + diff.slice(1)}`];

  btn.classList.remove("hidden", "disabled", "selected");
  if (diff === "extreme" || hasChart) { // Always enable extreme
    btn.disabled = false;
    btn.onclick = () => setDiffSelection(diff);
  } else {
    btn.classList.add("disabled");
    btn.disabled = true;
  }
  });

  // Reset selected difficulty
  selectedDifficulty = null;
  const bar = document.getElementById("difficulty-bar");
  bar.style.width = `0%`;



  if (!data) return;


  audio.src = `songfiles/${songName}.mp3`;
  //Plays song preview at low volume
  previewSong(`songfiles/${songName}.mp3`, 0.3);

  audio.onloadedmetadata = () => {
    const durationSecs = audio.duration || 0;
    const mins = Math.floor(durationSecs / 60);
    const secs = Math.round(durationSecs % 60).toString().padStart(2, '0');
    document.getElementById("duration-info").textContent = `Runtime: ${mins}:${secs}`;
  };

  document.getElementById("songTitle-info").textContent = data.songName || "Unknown Title";
  document.getElementById("artistName-info").textContent = data.artist || "Unknown Artist";
  document.getElementById("rank-info").textContent = `Best Non-Extreme Rank: ${rank}`;
  document.getElementById("extreme-rank-info").textContent = `Best Extreme Rank: ${extremeRank}`;
  document.getElementById("extraNotes").textContent = data.notesInfo || "No extra info";

  let originalNotes = data.extremeNotes;
  let hasExtremeCharting = false;
  data.notes = originalNotes || [];
  if (originalNotes){
    hasExtremeCharting = true;
  }
  document.getElementById("has-extreme-chart").textContent = hasExtremeCharting ? "This song has custom extreme charting!" : "This song does not have custom extreme charting.";

  document.getElementById("play-song-button").onclick = () => {
    if (!selectedDifficulty) return alert("Choose a difficulty first!");
    songNameGlobal = songName;
    selectedDifficultyGlobal = selectedDifficulty;
    startGame(songName, selectedDifficulty + "Notes");
  };
  document.getElementById("play-song-button").textContent = "Play Song!";

  document.getElementById("song-info").classList.remove("hidden");
  }


function restartGame() {
  const newDiff = prompt("Change difficulty? (easy, normal, hard, extreme)", selectedDifficultyGlobal);
  if (!newDiff) return; // Cancelled

  const lowerDiff = newDiff.toLowerCase();
  const validDiffs = ["easy", "normal", "hard", "extreme"];
  if (!validDiffs.includes(lowerDiff)) {
    alert("Invalid difficulty! Please choose from: easy, normal, hard, extreme.");
    return
  }

  selectedDifficultyGlobal = lowerDiff;
  returnToMenu();
  startGame(songNameGlobal, selectedDifficultyGlobal + "Notes");
}
function startGame(songName, chartType) {
  if (gameActive) return; // Prevent starting multiple games
  gameActive = true;
  songData = structuredClone(window[songName]);
  let originalNotes = songData[chartType];
  songData.notes = originalNotes || songData.hardNotes || songData.normalNotes || songData.easyNotes || [];
  songData.notes.sort((a, b) => a.time - b.time);
  const spreadKeys = ["a", "s", "d", "j", "k", "l"];
  
  // If original chart is missing and requested was extremeNotes, apply spread
  if (!originalNotes && chartType === "extremeNotes") {
    
    songData.notes = songData.notes.map(note => {
      let newKey = note.key;
      if (["a", "s", "d", "f"].includes(newKey)) {
        const rand = Math.floor(Math.random() * spreadKeys.length);
        newKey = spreadKeys[rand];
      }
      return { ...note, key: newKey };
    });
  }
  if (chartType === "extremeNotes") {
  
  
    // Hide col-f and show col-spacer
    document.querySelectorAll("#col-f").forEach(el => {
      el.classList.add("hidden");
    });
    document.querySelectorAll("#col-spacer").forEach(el => {
      el.classList.remove("hidden");
    });



    // Make sure j, k, l columns are visible
    ["j", "k", "l"].forEach(key => {
      document.querySelectorAll(`#col-${key}`).forEach(el => {
        el.classList.remove("hidden");
      });
    });
   
  
  } else {
    // No remap, show all keys as is
  
    // Show col-f and hide col-spacer using class
  document.querySelectorAll("#col-f").forEach(el => el.classList.remove("hidden"));
  document.querySelectorAll("#col-spacer").forEach(el => el.classList.add("hidden"));
     // Hide j, k, l with class "hidden"
    ["j", "k", "l"].forEach(key => {
      document.querySelectorAll(`#col-${key}`).forEach(el => el.classList.add("hidden"));
    });
    

  }
 
  flashyTransition();
  playSoundEffect("songfiles/clickstart.mp3", 0.3);
  previewSong("songfiles/menusong.mp3", 0); // stop preview
  setTimeout(() => {


  document.getElementById("menu").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  currentNotes = [];
  score = 0;
  combo = 0;
  totalNotes = songData.notes.length;
  missedNotes = 0;
  updateHUD();

  // reset spawn tracking
  activeNotes = [];
  nextNoteIndex = 0;

  const delay = songData.startDelay || 0;
  const songtitle = songData.songName;
  const artist = songData.artist;
  
  document.getElementById("song-title").textContent = `${songtitle} by ${artist} (${selectedDifficultyGlobal[0].toUpperCase() + selectedDifficultyGlobal.slice(1)})`;
  document.getElementById("title").classList.add("shrunk");

  audio.src = `songFiles/${songName}.mp3`;
  audio.currentTime = 0;
  audio.volume = 0.5; // range is 0.0 to 1.0


  // Automatically start recording
  if (autorecord) {
    toggleRecording();
  }
  recordedNotes = [];
  
  setTimeout(() => {
    audio.play().then(() => {

      startTime = performance.now() - delay;
      animationId = requestAnimationFrame(gameLoop);
    }).catch(err => {
      alert("Audio failed to play: " + err);
    });
  }, delay);
  }, 500); // delay to sync with transition
  

    document.getElementById("audio").onended = () => {
    if (autorecord) {
      toggleRecording(); // stop recording if active
    }
    gameActive = false;

    const maxScore = totalNotes * 230;
    const rankPercent = score / maxScore;
    let rank = "D";

    if (rankPercent >= 0.96) rank = "S+";
    else if (rankPercent >= 0.93) rank = "S";
    else if (rankPercent >= 0.87) rank = "S-";
    else if (rankPercent >= 0.80) rank = "A";
    else if (rankPercent >= 0.60) rank = "B";
    else if (rankPercent >= 0.40) rank = "C";
    else rank = "D";

    // compute next threshold
    let nextTarget = 0;
    if (rank === "D") nextTarget = Math.ceil(maxScore * 0.40);
    else if (rank === "C") nextTarget = Math.ceil(maxScore * 0.60);
    else if (rank === "B") nextTarget = Math.ceil(maxScore * 0.80);
    else if (rank === "A") nextTarget = Math.ceil(maxScore * 0.87);
    else if (rank === "S-") nextTarget = Math.ceil(maxScore * 0.93);
    else if (rank === "S") nextTarget = Math.ceil(maxScore * 0.96);
    else nextTarget = maxScore; // S+

    const toNext = Math.max(0, nextTarget - score);

    // show end-screen UI
    const endScreen = document.getElementById("end-screen");
    const gameEl = document.getElementById("game");
    const songtitle = songData.songName;
    const artist = songData.artist;
    // set song meta
    document.getElementById("end-song-title").textContent = `${songtitle}`;
    document.getElementById("end-song-artist").textContent = `${artist}`;
    document.getElementById("final-score").textContent = `Score: ${score} / ${maxScore}`;
    document.getElementById("final-misses").textContent = `Misses: ${missedNotes}`;
    document.getElementById("next-rank-progress").textContent = toNext > 0
      ? `${toNext} more points to reach next rank`
      : `Good work! You do got rythm!`;

    // rank badge (letter + subtitle)
    const badge = document.getElementById("end-rank-badge");
    const badgeLetter = document.getElementById("badge-letter");
    const badgeSub = document.getElementById("badge-sub");

    // derive a short letter to show (use S+ -> S+, S- -> S-)
    const displayLetter = rank;
    badgeLetter.textContent = displayLetter;
    badgeSub.textContent = rank === "S+" ? "Best Job!" : `Good Job!`;
    // perfect bonus override
    if (missedNotes === 0) {
      badgeLetter.textContent = "SS";
      badgeSub.textContent = "Flawless!";
    }

    // set color class
    badge.className = "rank-badge"; // reset classes
    const rankClass = "rank-" + rank.replace("+", "plus").replace("-", "");
    badge.classList.add(rankClass);

    // small celebratory confetti for high ranks
    const confetti = document.getElementById("end-confetti");
    confetti.innerHTML = ""; // reset
    if (["S+", "S", "S-"].includes(rank)) {
      // create simple confetti particles (DOM) — lightweight
      for (let i = 0; i < 35; i++) {
        const p = document.createElement("div");
        p.className = "confetti-piece";
        p.style.position = "absolute";
        p.style.left = Math.random() * 100 + "%";
        p.style.top = Math.random() * 10 + "%";
        p.style.width = (6 + Math.random() * 8) + "px";
        p.style.height = (8 + Math.random() * 10) + "px";
        p.style.opacity = 0.95;
        p.style.borderRadius = "2px";
        p.style.transform = `translateY(${20 + Math.random() * 40}px) rotate(${Math.random()*360}deg)`;
        p.style.background = "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.6))";
        p.style.filter = "drop-shadow(0 2px 6px rgba(0,0,0,0.12))";
        p.style.animation = `confettiFall ${1.2 + Math.random()*0.8}s ease-out forwards`;
        p.style.animationDelay = (Math.random()*0.4) + "s";
        confetti.appendChild(p);
      }
    }
    // --- XP reward (place this after rank / rankPercent / toNext computed) ---
    const rankXpMap = {
      "S+": 300,
      "S": 220,
      "S-": 160,
      "A": 100,
      "B": 60,
      "C": 55,
      "D": 50
    };

    // base XP for this rank
    let xpGain = rankXpMap[rank] || 0;

    // small accuracy bonus proportional to accuracy (0..50)
    xpGain += Math.round(rankPercent * 50);
    // flawless bonus
    if (missedNotes === 0) xpGain += 250;

    if (chartType == "extremeNotes") xpGain = Math.floor(xpGain * 1.25); // 25% bonus for extreme
    // clamp & ensure integer
    xpGain = Math.max(0, Math.floor(xpGain));

    levelWidgets[0].addXP(xpGain); // add to first widget (all share XP)

    // bring up end-screen
    gameEl.classList.add("hidden");
    endScreen.classList.remove("hidden");
    endScreen.setAttribute("aria-hidden","false");

    // badge pop
    playSoundEffect("songfiles/sparkle.mp3", 0.3);
    badge.classList.add("pop");
    setTimeout(() => badge.classList.remove("pop"), 1200);
    // subtle pulse for good ranks
    if (["S+","S","S-","A"].includes(rank)) badge.classList.add("pulse");

    // save rank 
    let songRanks = JSON.parse(localStorage.getItem("songRanks") || "{}");
    let savedName = songData.songName;
    if (selectedDifficultyGlobal === "extreme") savedName = "extreme " + savedName;
    const prevRank = songRanks[savedName] || "F";
    const rankOrder = ["F","D","C","B","A","S-","S","S+"];
    if (rankOrder.indexOf(rank) > rankOrder.indexOf(prevRank)) {
      songRanks[savedName] = rank;
      localStorage.setItem("songRanks", JSON.stringify(songRanks));
    }

    // multiple buttons behavior
    document.getElementById("back-menu").onclick = () => {
      endScreen.classList.add("hidden");
      endScreen.setAttribute("aria-hidden","true");
      returnToMenu(); // use existing function
    };
    document.getElementById("replay").onclick = () => {
      endScreen.classList.add("hidden");
      endScreen.setAttribute("aria-hidden","true");
      // restart same song and difficulty
      returnToMenu();
      startGame(songName, selectedDifficultyGlobal === "extreme" ? "extremeNotes" : selectedDifficultyGlobal + "Notes" || "normalNotes");
    };

    // tiny confetti CSS keyframes injection (only once, safe)
    if (!document.getElementById("confetti-styles")) {
      const s = document.createElement("style");
      s.id = "confetti-styles";
      s.textContent = `
        @keyframes confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity:1; }
          60% { opacity:1; }
          100% { transform: translateY(260px) rotate(420deg); opacity:0; }
        }
        .confetti-piece { will-change: transform, opacity; }
      `;
      document.head.appendChild(s);
    }

    updateRankProgressDisplay && typeof updateRankProgressDisplay === "function" && updateRankProgressDisplay();
  };


}



// ---- optimized gameLoop ----
function gameLoop(timestamp) {
  const audioEl = document.getElementById("audio");
  const elapsed = (audioEl.currentTime * 1000) + (songData.audioOffset || 0);

  // Spawn only upcoming notes using an index pointer (O(k) per frame, k = notes spawned)
  while (nextNoteIndex < songData.notes.length && elapsed >= songData.notes[nextNoteIndex].time) {
    const noteObj = songData.notes[nextNoteIndex];
    spawnNote(noteObj.key);
    nextNoteIndex++;
  }

  // Move activeNotes array (use numeric _y and transform for GPU compositing)
  // Update in-place and remove offscreen/hit notes efficiently
  for (let i = activeNotes.length - 1; i >= 0; i--) {
    const el = activeNotes[i];
    // store numeric position on element to avoid reading computed styles
    el._y += 4; // speed (px/frame) — keep same as previous 4px
    el.style.transform = `translateY(${el._y}px)`;

    // if note passed the hit zone
    if (el._y > 600 && !el.classList.contains("hit")) {
      const key = el.dataset.key;
      // remove DOM and array entry
      el.remove();
      activeNotes.splice(i, 1);
      registerMiss(key);
    }
  }

  // Throttle runtime text updates to reduce string allocations and layout churn
  const now = performance.now();
  if (now - lastRuntimeUpdate > 100) { // update every 100ms
    const timeLeft = Math.max(0, (audioEl.duration || 0) - audioEl.currentTime).toFixed(1);
    document.getElementById("runtime").textContent = `Runtime: -${timeLeft}s`;
    lastRuntimeUpdate = now;
  }

  animationId = requestAnimationFrame(gameLoop);
}

 // ---- optimized spawnNote 
// small spawn debounce (keep low so close notes still appear)
function spawnNote(key) {
  const now = performance.now();
  if (lastSpawnTime[key] && now - lastSpawnTime[key] < 40) return; // 40ms debounce
  lastSpawnTime[key] = now;

  const col = document.getElementById("col-" + key);
  if (!col) return;

  const note = document.createElement("div");
  note.className = "note";
  note.dataset.key = key;
  note.dataset.spawnTime = now;

  note._y = 0;
  note.style.transform = `translateY(0px)`;
  note.style.willChange = "transform";

  const inner = document.createElement("div");
  inner.className = "note-inner";
  note.appendChild(inner);

  col.appendChild(note);

  activeNotes.push(note);
  activeNotesByKey[key].push(note);
}


function showFeedback(text, type) {
  if (!gameActive) return; // Don't show feedback if game is not active
  const feedback = document.getElementById("feedback");
  feedback.textContent = text;
  feedback.classList.remove("perfect", "miss");
  if (type === "miss") {
    feedback.classList.add("miss");
    document.body.classList.add("miss-feedback");
    setTimeout(() => {
      document.body.classList.remove("miss-feedback");
    }, 300);
  } else if (type === "perfect") {
    feedback.classList.add("perfect");
  }
  feedback.style.opacity = 1;

  setTimeout(() => {
    feedback.style.opacity = 0;
  }, 700); // make feedback visible a bit longer
}

// Single improved keydown handler
document.addEventListener("keydown", (e) => {
  // do NOT block e.repeat — players often hammer keys quickly
  const rawKey = e.key.toLowerCase();
  let key = rawKey;
  if (selectedDifficultyGlobal !== "extreme") {
    if (rawKey === "k") key = "d";
    else if (rawKey === "l") key = "f";
  }

  const col = document.getElementById("col-" + key);
  if (!col) return;

  // visual feedback
  col.classList.add("active");
  setTimeout(() => col.classList.remove("active"), 100);

  const pool = activeNotesByKey[key] || [];
  if (pool.length === 0) {
    registerMiss(key);
    return;
  }

  const hitZone = 510;
  const tolerance = 50;

  // Choose best candidate:
  // 1) prefer notes at or BEFORE hitZone (y <= hitZone) and closest (largest y but <= hitZone)
  // 2) otherwise choose the closest AFTER hitZone within tolerance.
  let bestNote = null;
  let bestMetric = Infinity;

  // first pass: notes <= hitZone
  for (let note of pool) {
    if (!note || note.classList.contains("processing") || note.classList.contains("hit")) continue;
    const y = (typeof note._y === "number") ? note._y : parseFloat(note.style.top || "0");
    if (y <= hitZone + tolerance) {
      // metric: distance to hit (smaller is better). For <= hitZone prefer larger y (closer but not past)
      const distance = Math.abs(y - hitZone);
      if (y <= hitZone && distance <= tolerance) {
        // give strong preference to notes that are at or before the line
        if (distance < bestMetric) {
          bestMetric = distance;
          bestNote = note;
        }
      }
    }
  }

  // second pass: if we didn't find a note before/at the line, look for after it
  if (!bestNote) {
    let bestAfterDistance = Infinity;
    for (let note of pool) {
      if (!note || note.classList.contains("processing") || note.classList.contains("hit")) continue;
      const y = (typeof note._y === "number") ? note._y : parseFloat(note.style.top || "0");
      const distance = Math.abs(y - hitZone);
      if (distance <= tolerance && distance < bestAfterDistance) {
        bestAfterDistance = distance;
        bestNote = note;
      }
    }
    bestMetric = bestAfterDistance !== Infinity ? bestAfterDistance : Infinity;
  }

  if (!bestNote) {
    registerMiss(key);
    return;
  }

  // Immediately lock and remove from pools so rapid presses hit the next note
  bestNote.classList.add("processing", "hit");
  removeFromPoolsImmediate(bestNote);

  // keep element for animation, then remove
  setTimeout(() => bestNote.remove(), 360); // allow hit animation to play

  // scoring
  combo++;
  let baseScore = 100;
  if (combo >= comboBonusThreshold) baseScore *= 2;
  const perfectBonus = bestMetric < 15 ? 50 : 0;
  score += baseScore + perfectBonus;

  updateHUD();
  updateComboVisuals();

  // only show 'Perfect' when close
  if (bestMetric < 15) showFeedback("Perfect!","perfect");
});

// ---------- helper to remove from pools ----------
function removeFromPoolsImmediate(note) {
  const key = note.dataset.key;
  const idx = activeNotes.indexOf(note);
  if (idx !== -1) activeNotes.splice(idx, 1);
  const arr = activeNotesByKey[key];
  const j = arr ? arr.indexOf(note) : -1;
  if (j !== -1) arr.splice(j, 1);
}

function registerMiss(key = null) {
  missedNotes++;
  combo = 0;
  updateHUD();
  updateComboVisuals();
  showFeedback("Miss!", "miss");

  if (key) {
    const col = document.getElementById("col-" + key);
    col.classList.add("miss");
    setTimeout(() => col.classList.remove("miss"), 200);
  }
  const activeCols = document.querySelectorAll(".active");
  activeCols.forEach(col => {
    col.classList.add("miss");
    setTimeout(() => col.classList.remove("miss"), 200);
  });
}
// makes colums clickable
['a', 's', 'd', 'f','j','k','l'].forEach((key) => {
  const col = document.getElementById("col-" + key);
  col.addEventListener("click", () => {
    const event = new KeyboardEvent("keydown", { key });
    document.dispatchEvent(event);
  });
});
updateRankProgressDisplay();
// Attach click listeners to all song buttons
document.querySelectorAll(".song-section button").forEach(btn => {
  btn.addEventListener("click", () => {
    const section = btn.closest(".song-section");
    const style = getComputedStyle(btn);
    const gradient = style.backgroundImage;

    // update the CSS variable for notes
    document.documentElement.style.setProperty("--note-gradient", gradient);

   
  });
});


function returnToMenu() {
  gameActive = false;
  combo = 0;
  
  updateComboVisuals();
  // Hide game & end screen, show menu
  document.getElementById("end-screen").classList.add("hidden");
  document.getElementById("game").classList.add("hidden");
  document.getElementById("menu").classList.remove("hidden");
  document.getElementById("song-info").classList.add("hidden");

  // Stop animation
  cancelAnimationFrame(animationId);

  // Stop audio
  const audio = document.getElementById("audio");
  audio.pause();
  audio.currentTime = 0;

  // Clear notes
  document.querySelectorAll(".note").forEach(n => n.remove());

  // Reset music to menu
  toggleMenuMusic();
  flashyTransition();


}


//-------- HUD and Visual Updates --------

// Useful console command to toggle: toggleRecording();
function updateHUD() {
  document.getElementById("score").textContent = `Score: ${score}`;
  document.getElementById("combo").textContent = `Combo: ${combo}`;
}
function updateComboVisuals() {
  if (combo == comboBonusThreshold) {
    document.body.classList.add("combo-active");
    document.getElementById("combo").textContent = `2x Bonus! Combo: ${combo}`;
    document.body.classList.add("combo-enter");
  } else if (combo < comboBonusThreshold) {
    document.body.classList.remove("combo-active");
    document.body.classList.remove("combo-enter"); // remove delay for reverse
  }
  else{
    document.getElementById("combo").textContent = `2x Bonus! Combo: ${combo}`;
  }
}

function updateRankProgressDisplay() {
  const songRanks = JSON.parse(localStorage.getItem("songRanks") || "{}");
  const rankOrder = ["F", "D", "C", "B", "A", "S-", "S", "S+"];
  let countA = 0, countS = 0, countSPlus = 0;

  for (let rank of Object.values(songRanks)) {
    const idx = rankOrder.indexOf(rank);
    if (idx >= rankOrder.indexOf("A")) countA++;
    if (idx >= rankOrder.indexOf("S")) countS++;
    if (idx === rankOrder.indexOf("S+")) countSPlus++;
  }

  document.getElementById("rankAProgress").textContent = `Songs with at least A Rank: ${countA}`;
  document.getElementById("rankSProgress").textContent = `Songs with at least S Rank: ${countS}`;
  document.getElementById("rankSPlusProgress").textContent = `Songs with S+ Rank: ${countSPlus}`;

};

//------ Toggling Song Lists and Themes  & Effects------


function switchSongLists() {

  const holidayList = document.getElementById("holiday-song-list");
  const mainList = document.getElementById("song-list");
  const toggleBtn = document.getElementById("toggle-songlist-button");
  const sabrinaIMG = document.getElementById("sabrinaimage");
  const root = document.documentElement; // for CSS variables
  
  
  setTimeout(() => {
  // Toggle theme state and update UI
  if (theme === "main") { 
    holidayList.classList.remove("hidden");
    mainList.classList.add("hidden");

    toggleBtn.textContent = "Switch to Main Song List";
    toggleBtn.style.background = "linear-gradient(135deg, #ff4e50, #fc913a)";
    sabrinaIMG.src = "images/snowman.PNG";
    sabrinaIMG.style.marginBottom = "100px";
    sabrinaIMG.style.marginTop= "50px";
    

    // swap CSS vars for holiday
    root.style.setProperty("--menu-mid", "#5f49b1ff");
    root.style.setProperty("--menu-end", "#1937a4ff");

    theme = "holiday";
  }
  else if (theme === "holiday") {
    holidayList.classList.add("hidden");
    mainList.classList.remove("hidden");
    toggleBtn.textContent = "Switch to Holiday Song List";
    toggleBtn.style.background = "linear-gradient(135deg, #43cea2, #185a9d)";
    sabrinaIMG.src = "images/sabrina.PNG";
    sabrinaIMG.style.marginBottom = "0px";
    sabrinaIMG.style.marginTop= "0px";
    

    // swap CSS vars for main
    root.style.setProperty("--menu-mid", "#6b4c9a");
    root.style.setProperty("--menu-end", "rgb(57, 0, 101)");
    theme = "main";
  }
  }, 500); // delay to sync with transition
  flashyTransition();
  
}

  // Flashy transition effect
function flashyTransition() { 
  const overlay = document.getElementById('transition-overlay');
  const game = document.getElementById('game');
  const root = document.documentElement;

  if (theme === "main") {
  root.style.setProperty("--transition-gradient", 
    "radial-gradient(circle at center, #fff0c2 0%, #fca17d 40%, #5a6794 100%)"
  );
} else if (theme === "holiday") {
  root.style.setProperty("--transition-gradient", 
    "radial-gradient(circle at center, #e3f2fd 0%, #90caf9 40%, #1565c0 100%)"
  );
}

  // Make overlay visible
  overlay.style.opacity = '1';

  // Show game just before the flashy animation hits
  setTimeout(() => {
    game.classList.add('flashy-enter');
  }, 0);
  // Let the glow hit and fade out
  setTimeout(() => {
    overlay.style.opacity = '0';
    game.classList.remove('flashy-enter');
  }, 700);
}


function playSoundEffect(src, volume = 0.5) {
  const sfx = new Audio(src);
  sfx.volume = volume;
  sfx.play();

  // stop after 4 seconds with fade
  const fadeDuration = 1000; // ms
  const stopTime = 4000;    // ms

  setTimeout(() => {
    const steps = 15;
    const stepTime = fadeDuration / steps;
    let step = 0;

    const fadeInterval = setInterval(() => {
      step++;
      sfx.volume = Math.max(0, volume * (1 - step / steps));

      if (step >= steps) {
        clearInterval(fadeInterval);
        sfx.pause();
        sfx.currentTime = 0;
      }
    }, stepTime);

  }, stopTime);
}
let previewTimeout = null;
let fadeInterval = null;

function previewSong(src, volume = 0.5) {
  const sfx = document.getElementById("preview-song-audio");

  // cancel previous stuff
  if (previewTimeout) {
    clearTimeout(previewTimeout);
    previewTimeout = null;
  }
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }

  sfx.pause();
  sfx.currentTime = 0;

  // start new preview
  sfx.src = src;
  sfx.volume = 0; // start silent for fade-in
  sfx.currentTime = Math.random() * (sfx.duration || 60);
  sfx.play();

  /* FADE IN */
  const fadeInDuration = 1000; 
  const inSteps = 15;
  const inStepTime = fadeInDuration / inSteps;
  let inStep = 0;

  fadeInterval = setInterval(() => {
    inStep++;
    sfx.volume = Math.min(volume, (volume * inStep) / inSteps);

    if (inStep >= inSteps) {
      clearInterval(fadeInterval);
      fadeInterval = null;
    }
  }, inStepTime);

  /* FADE OUT + STOP */
  const fadeOutDuration = 1000;
  const stopTime = 4000;

  previewTimeout = setTimeout(() => {
    const outSteps = 15;
    const outStepTime = fadeOutDuration / outSteps;
    let outStep = 0;

    fadeInterval = setInterval(() => {
      outStep++;
      sfx.volume = Math.max(0, volume * (1 - outStep / outSteps));

      if (outStep >= outSteps) {
        clearInterval(fadeInterval);
        fadeInterval = null;
        sfx.pause();
        sfx.currentTime = 0;
      }
    }, outStepTime);
  }, stopTime);
}


// Fun Bonus, Random Song Info Display

function showRANDOMSongInfo() {
  const songButtons = document.querySelectorAll(".song-section button");
  // exclude the random button 
  const randomIndex = Math.floor(Math.random() * (songButtons.length-1));
  const randomButton = songButtons[randomIndex];
  randomButton.click();
  showSongInfo(randomButton);
}

function toggleMenuMusic() {
  const audio = document.getElementById("audio");
  if (audio.paused || audio.src.includes("menusong.mp3") === false) {
    audio.currentTime = 0;
    audio.src = `songfiles/menusong.mp3`;
    volume = 0.2;
    audio.volume = volume;
    audio.play();
  } else {
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        audio.volume = audio.volume - 0.02;
      }, 100 * i);
      setTimeout(() => {
        if (i === 9 ){
          audio.pause();
          audio.currentTime = 0;
        };
      }, 1100);
    }

  }
}
// --------- Recording Functionality ---------

function toggleRecording() {
  recording = !recording;
  if (recording) {
    recordedNotes = [];
    console.log("🎙 Recording started...");
    showFeedback("Recording started!", "perfect");
    playSoundEffect("songfiles/sparkle.mp3", 0.3);
    
  } else {
    console.log("🛑 Recording stopped. Copy this into your song file:");
    showFeedback("Recording stopped!", "perfect");
    
    console.log(JSON.stringify(recordedNotes, null, 2));
  }
}
document.addEventListener("keydown", (e) => {
  if (!recording) return;
let keyMap= {};

  const key = e.key.toLowerCase();
  if (selectedDifficultyGlobal != "extreme" ) {
    keyMap = {
      'a': 'a',
      's': 's',
      'k': 'd',
      'l': 'f'
    }
  }
  else {
    keyMap = {
      'a': 'a',
      's': 's',
      'd': 'd',
      'j': 'j',
      'k': 'k',
      'l': 'l'
    }
  }
  

  if (key in keyMap) { // Check if the key is in the keyMap
    recordedNotes.push({ time: Math.round(audio.currentTime * 1000), key: keyMap[key] });
    console.log('Recorded:', recordedNotes[recordedNotes.length - 1]);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey && e.key.toLowerCase() === "o") {
    e.preventDefault(); // stops normal
    autorecord = !autorecord;
    showFeedback(`Auto-Recording ${autorecord ? "Enabled" : "Disabled"}`, "perfect");
  }
});

//------------------- STUFF that needs to happen, not in functions just happen--------------------------------

// Start the cursor animation loop
animateCursor();

// Auto-switch to holiday theme in winter months
const month = new Date().getMonth();
if (month === 11 || month === 0 || month === 1) { // December, January, February
  switchSongLists();
}
else if (winterAuto){
  switchSongLists();
}

// Click sound effect for buttons
const clickSound = document.getElementById("click-sound");
  document.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      playSoundEffect("songfiles/click.mp3", 0.1);
      levelWidgets[0].addXP(1); // add XP on button click
    }
});






//----- Custom Cursor Implementation -----




// Update mouse position
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Smooth follow effect
function animateCursor() {
  cursorX += (mouseX - cursorX) * 0.1;
  cursorY += (mouseY - cursorY) * 0.1;

  cursor.style.left = `${cursorX}px`;
  cursor.style.top = `${cursorY}px`;
  realcursor.style.left = `${mouseX}px`;
  realcursor.style.top = `${mouseY}px`;

  requestAnimationFrame(animateCursor);
}

// Add pop effect
document.addEventListener('mousemove', () => {
  cursor.classList.remove('active');
  realcursor.classList.remove('active');
  realcursor.classList.remove('game-active'); 
  cursor.classList.remove('game-active');
  
  clearTimeout(cursor.popTimeout);
  clearTimeout(realcursor.popTimeout);
  cursor.popTimeout = setTimeout(() => {
    cursor.classList.add('active');
    realcursor.classList.add('active');
    if (gameActive) {realcursor.classList.add('game-active'); cursor.classList.add('game-active');}

  }, 500);
});


