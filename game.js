let currentNotes = [];
let songData = null;
let startTime = null;
let animationId = null;
let score = 0;
let combo = 0;
let comboBonusThreshold = 20;
let recording = false; // not where you change this
let autorecord = true; // if you want to record automatically when starting a song
let recordedNotes = [];
let totalNotes = 0;
let missedNotes = 0;
let selectedDifficultyGlobal = null;
let songNameGlobal = null;


function toggleRecording() {
  recording = !recording;
  if (recording) {
    recordedNotes = [];
    console.log("🎙 Recording started...");
    showFeedback("Recording started! Press keys to record notes.", "perfect");
  } else {
    console.log("🛑 Recording stopped. Copy this into your song file:");
    showFeedback("Recording stopped! Check console for recorded notes.", "perfect");
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

// Useful console command to toggle: toggleRecording();
function updateHUD() {
  document.getElementById("score").textContent = `Score: ${score}`;
  document.getElementById("combo").textContent = `Combo: ${combo}`;
}
function updateComboVisuals() {
  if (combo >= comboBonusThreshold) {
    document.body.classList.add("combo-active");
    document.getElementById("combo").textContent = `2x Bonus! Combo: ${combo}`;
  } else {
    document.body.classList.remove("combo-active");
  }
}
/**
 * Updates the display of rank progress for songs based on their ranks stored in localStorage.
 * It calculates the number of songs that have at least an A, S, and S+ rank,
 * and updates the corresponding HTML elements with the progress information.
 *
 * @function updateRankProgressDisplay
 * @returns {void}
 */
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

  document.getElementById("rankAProgress").textContent = `Songs with at least A Rank: ${countA}/40`;
  document.getElementById("rankSProgress").textContent = `Songs with at least S Rank: ${countS}/40`;
  document.getElementById("rankSPlusProgress").textContent = `Songs with S+ Rank: ${countSPlus}/40`;

};

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

  

  document.getElementById("final-rank").textContent = `Rank: ${rank}`;
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
  songData = structuredClone(window[songName]);
  let originalNotes = songData[chartType];
  songData.notes = originalNotes || songData.extremeNotes || songData.hardNotes || songData.normalNotes || [];
  
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
  const audio = document.getElementById("audio");

  document.getElementById("menu").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  currentNotes = [];
  score = 0;
  combo = 0;
  totalNotes = songData.notes.length;
  missedNotes = 0;
  updateHUD();

  const delay = songData.startDelay || 0;
  const songtitle = songData.songName;
  const artist = songData.artist;
  
  document.getElementById("song-title").textContent = `${songtitle} by ${artist} (${selectedDifficultyGlobal[0].toUpperCase() + selectedDifficultyGlobal.slice(1)})`;
  document.getElementById("title").classList.add("shrunk");



  audio.src = `songfiles/${songName}.mp3`;
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
  const overlay = document.getElementById('transition-overlay');
  const game = document.getElementById('game');

  // Make overlay visible
  overlay.style.opacity = '1';

  // Show game just before the flashy animation hits
  setTimeout(() => {
    game.classList.remove('hidden');
    game.classList.add('flashy-enter');
  }, 100);
  // Let the glow hit and fade out
  setTimeout(() => {
    overlay.style.opacity = '0';
    game.classList.remove('flashy-enter');
  }, 700);
  document.getElementById("audio").onended = () => {
    toggleRecording(); // Stop recording when song ends
    const maxScore = totalNotes * 230;
    const rankPercent = score / maxScore;
    let rank = "D";

    if (rankPercent >=.96) rank = "S+";
    else if (rankPercent >= 0.93) rank = "S";
    else if (rankPercent >= 0.87) rank = "S-";
    else if (rankPercent >= 0.80) rank = "A";
    else if (rankPercent >= 0.60) rank = "B";
    else if (rankPercent >= 0.40) rank = "C";

    // How many more points needed for next rank
    let nextTarget = 0;
    if (rank === "D") nextTarget = Math.ceil(maxScore * 0.40);
    else if (rank === "C") nextTarget = Math.ceil(maxScore * 0.60);
    else if (rank === "B") nextTarget = Math.ceil(maxScore * 0.80);
    else if (rank === "A") nextTarget = Math.ceil(maxScore * 0.87);
    else if (rank === "S-") nextTarget = Math.ceil(maxScore * .93);
    else if (rank === "S") nextTarget = Math.ceil(maxScore * .96);
    else nextTarget = score; // S+ = max

    const toNext = Math.max(0, nextTarget - score);
    // Save highest rank per song
    let songRanks = JSON.parse(localStorage.getItem("songRanks") || "{}");
    if (selectedDifficultyGlobal === "extreme") {
      songData.songName = "extreme " + songData.songName;
    }
    const prevRank = songRanks[songData.songName] || "F";
    

    // Only save if current rank is higher
    const rankOrder = ["F", "D", "C", "B", "A", "S-", "S", "S+"];
    if (rankOrder.indexOf(rank) > rankOrder.indexOf(prevRank)) {
      songRanks[songData.songName] = rank;
      localStorage.setItem("songRanks", JSON.stringify(songRanks));
    }
    // Show end screen

    document.getElementById("end-screen").classList.remove("hidden");
    document.getElementById("game").classList.add("hidden");

    document.getElementById("final-rank").textContent = `Rank: ${rank}`;
    document.getElementById("final-score").textContent = `Score: ${score} / ${maxScore}`;
    document.getElementById("final-misses").textContent = `Misses: ${missedNotes}`;
    document.getElementById("next-rank-progress").textContent = toNext > 0
      ? `${toNext} more points to reach next rank`
      : `Good work! You do got rythm!`;
    updateRankProgressDisplay();
  };

}


function returnToMenu() {
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
  audio.src = `menusong.mp3`;
  audio.play();

}
function gameLoop(timestamp) {
  const audio = document.getElementById("audio");
  const elapsed = (document.getElementById("audio").currentTime * 1000) + (songData.audioOffset || 0);
  // Generate notes based on song map
  songData.notes.forEach(note => {
    if (!note.spawned && elapsed >= note.time) {
      
      spawnNote(note.key);
      note.spawned = true;
    }
  });

  // Move existing notes
  document.querySelectorAll(".note").forEach(note => {
    let top = parseFloat(note.style.top);
    note.style.top = (top + 4) + "px";
    if (top > 600 && !note.classList.contains("hit")) {
      const key = note.dataset.key;
      note.remove();
      registerMiss(key); // pass key that missed
    }
  });

  animationId = requestAnimationFrame(gameLoop);
  const timeLeft = Math.max(0, audio.duration - audio.currentTime).toFixed(1);
  document.getElementById("runtime").textContent = `Runtime: -${timeLeft}s`;
}
const lastSpawnTime = {};

function spawnNote(key) {
  const now = performance.now();
  if (lastSpawnTime[key] && now - lastSpawnTime[key] < 150) {
    console.log(`Skipping note spawn for ${key} to prevent spam.`);
    return;
  }

  

  lastSpawnTime[key] = now;

  const col = document.getElementById("col-" + key);
  const note = document.createElement("div");
  note.classList.add("note");
  note.dataset.key = key;
  note.dataset.spawnTime = now;
  note.style.top = "0px";
  col.appendChild(note);
}
function showFeedback(text, type) {
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
document.addEventListener("keydown", (e) => {
  let key = e.key.toLowerCase();
  let rawKey = e.key.toLowerCase();

  if (selectedDifficultyGlobal != "extreme" ) {
  if (rawKey === 'k') {
    key = 'd';
  } else if (rawKey === 'l') {
    key = 'f';
  } else {
    key = rawKey;
  }
  }
  const col = document.getElementById("col-" + key);
  const notes = Array.from(col.getElementsByClassName("note"));
  col.classList.add("active");
  setTimeout(() => col.classList.remove("active"), 150);
  for (let note of notes) {
    const noteTop = parseFloat(note.style.top);
    const hitZone = 520;
    const tolerance = 60;

    const distance = Math.abs(noteTop - hitZone);

if (distance < 15) {
  // Perfect hit
  note.classList.add("hit");
  setTimeout(() => note.remove(), 150);
  combo++;
  let baseScore = 100;
  if (combo >= comboBonusThreshold) baseScore *= 2;
  score += baseScore + 50; // extra perfect bonus
  updateHUD();
  updateComboVisuals();
  showFeedback("Perfect!", "perfect");
  return;
} else if (distance < tolerance) {
  // Normal hit
  note.classList.add("hit");
  setTimeout(() => note.remove(), 150);
  combo++;
  let baseScore = 100;
  if (combo >= comboBonusThreshold) baseScore *= 2;
  score += baseScore;
  updateHUD();
  updateComboVisuals();

  return;
}

  }

  // Miss (no note in hit zone)

  registerMiss();

});
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
['a', 's', 'd', 'f'].forEach((key) => {
  const col = document.getElementById("col-" + key);
  col.addEventListener("click", () => {
    const event = new KeyboardEvent("keydown", { key });
    document.dispatchEvent(event);
  });
});
updateRankProgressDisplay();