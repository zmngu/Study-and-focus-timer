/*TIMER SETTINGS*/ 
const TIMER_DURATIONS = {
    focus: 60 * 60,
    short: 10 * 60,
    long: 20 * 60
};

const STORAGE_KEY = "studySpaceData";

/*GET HTML ELEMENTS*/
const timerTime = document.getElementById("timer-time");
const timerStatus = document.getElementById("timer-status");
const timerProgressFill = document.getElementById("timer-progress-fill");
const timerProgress = document.querySelector(".timer-progress");

const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const resetButton = document.getElementById("reset-button");

const modeButtons = document.querySelectorAll(".mode-button");

const todayTime = document.getElementById("today-time");
const weekTime = document.getElementById("week-time");

const dailyGoal = document.getElementById("daily-goal");
const goalLabel = document.getElementById("goal-label");
const goalProgressFill = document.getElementById("goal-progress-fill");
const goalMessage = document.getElementById("goal-message");

const studyHistoryList = document.getElementById("study-history-list");

/*TIMER VARIABLES*/
let currentMode = "focus";
let remainingSeconds = TIMER_DURATIONS.focus;
let timerInterval = null;
let endTime = null;
let isRunning = false;

/*LOAD SAVED DATA*/
function loadStudyData() {
    const defaultData = {
        sessions: [],
        dailyGoal: 120
    };

    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if(!savedData) {
            return defaultData;
        }

        const parsedData = JSON.parse(savedData);

        return {
            sessions: Array.isArray(parsedData.sessions)
                ? parsedData.sessions.filter(session => 
                    session &&
                    typeof session.date === "string" &&
                    Number.isFinite(session.duration) &&
                    session.duration > 0 &&
                    session.duration <= 480
                )
                : [],
            dailyGoal:
            Number.isFinite(parsedData.dailyGoal) &&
            parsedData.dailyGoal >= 30 &&
            parsedData.dailyGoal <= 480
                ? parsedData.dailyGoal
                : 120
        };
    } catch(error) {
        console.error("Could not load study date:", error);
        return defaultData;
    }
}

let studyData = loadStudyData();

/*SAVE DATA TO LOCAL STORAGE*/
function saveStudyData() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(studyData)
        );
        return true;
    } catch (error) {
        console.error("Could not save study data:", error);

        goalMessage.textContent = "Your changes could not be saved. Check browser storage.";

        return false;
    }
}

/*FORMAT TIME*/
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );
}

function formatStudyTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes} min`;
    }

    if (minutes === 0) {
        return `${hours} hr`;
    }

    return `${hours} hr ${minutes} min`;
}

/*TIMER DISPLAY*/
function updateTimerDisplay() {
    timerTime.textContent = formatTime(remainingSeconds);

    const elapsedSeconds = TIMER_DURATIONS[currentMode] - remainingSeconds;

    const progress = (elapsedSeconds / TIMER_DURATIONS[currentMode]) * 100;

    timerProgressFill.computedStyleMap.width = `${Math.max(0, Math.min(100, progress))}%`;

    timerProgress.setAttribute(
        "aria-valuenow", 
        String(Math.round(progress))
    );

    document.title = `${formatTime(remainingSeconds)} | Study Space`;
}

function updateTimerStatus() {
   const modeNames ={
    focus: "Focus session",
    short: "Short break", 
    long: "Long break"
   };

   timerStatus.textContent = isRunning 
        ? `${modeNames[currentMode]} in progress`
        : currentMode === "focus"
            ? "Ready to focus?"
            : "Ready for a break?";
}

/*START THE TIMER*/
function startTime() {
    if (isRunning) {
        return;
    }

    if (remainingSeconds <= 0) {
        remainingSeconds = TIMER_DURATIONS[currentMode];
    }

    isRunning = true;
    endTime = Date.now() + remainingSeconds * 1000;

    startButton.disabled = true;
    pauseButton.disabled = false;
    resetButton.disabled = false;

    startButton.textContent = "Running...";
    updateTimerStatus();

    timerInterval = setInterval(tick, 250);
    tick();
}

/*COUNTDOWN*/
function tick() {
    if (!isRunning || endTime === null) {
        return;
    }

    //calculate from the end time so countdown stays accurate if browser pauses intervals
    remainingSeconds = Math.max(
        0, 
        Math.ceil((endTime - Date.now()) / 1000)
    );

    updateTimerDisplay();

    if (remainingSeconds === 0) {
        completeTimer();
    }
}

/*PAUSE TIMER*/
function pauseTimer() {
    if (!isRunning) {
        return;
    }

    //capture the remaining time before stopping
    remainingSeconds = Math.max(
        0,
        Math.ceil((endTime - Date.now()) / 1000)
    );

    isRunning = false;
    endTime = null;

    clearInterval(timerInterval);
    timerInterval = null;

    if(remainingSeconds === 0) {
        completeTimer();
        return;
    }

    startButton.disabled = false;
    pauseButton.disabled = true;
    startButton.textContent = currentMode === "focus" ? "Resume Focus" : "Resume Break";

    timerStatus.textContent = "Timer paused";
    updateTimerDisplay();
}

/*RESET TIMER*/
function resetTimer() {
    stopTimerInterval();

    remainingSeconds = TIMER_DURATIONS[currentMode];

    startButton.disabled = false;
    pauseButton.disabled = true;

    startButton.textContent = currentMode === "focus" ? "Start Focus" : "Start Break";

    updateTimerDisplay();
    updateTimerStatus();
}

function stopTimerInterval() {
    isRunning = false;
    endTime = null;

    if(timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/*COMPLETE TIMER SESSION*/
function completeTimer() {
    stopTimerInterval();

    remainingSeconds = 0;

    startButton.disabled = false;
    pauseButton.disabled = true;
    startButton.textContent = "Start Again";

    updateTimerDisplay();

    if(currentMode === "focus") {
        //COUNT ONLY A FULLY COMPLETED 60 MIN FOCUS
        studyData.sessions.push({
            date: new Date().toISOString(),
            duration: TIMER_DURATIONS.focus / 60
        });

        const saved = saveStudyData(); 

        refreshStudyTracker();

        timerStatus.textContent = saved
            ? "Focus complete! Great work!"
            : "Focus complete! Your history could  not be saved.";
    } else {
        timerStatus.textContent = "Break finished! Ready for another session?";
    }

    //play short notification sound using browser
    playCompletionSound();
}

//SWITCH TIMER MODES
function selectMode(mode) {
    if(!Object.prototype.hasOwnProperty.call(
        TIMER_DURATIONS, mode
    )) {
        return;
    }

    stopTimerInterval(); 

    currentMode = mode;
    remainingSeconds = TIMER_DURATIONS[currentMode];

    modeButtons.forEach(button => {
        const isActive = button.dataset.mode === currentMode;

        button.classList.toggle("active", isActive);
        button.setAttribute(
            "aria-pressed",
            String(isActive)
        );
    });

    startButton.disabled = false;
    pauseButton.disabled = true;

    startButton.textContent = currentMode === "focus" ? "Start Focus" : "Start Break";

    updateTimerDisplay();
    updateTimerStatus();
}

//CALCULATE
function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getTodayMinutes() {
    const today = getLocalDateKey(new Date());

    return studyData.sessions.filter(session => {
        const sessionDate = new Date(session.date);

        return !Number.isNaN(sessionDate.getTime()) && getLocalDateKey(sessionDate) === today;
    })
    .reduce((total, session) => total + session.duration, 0);
}

function getWeekMinutes() {
    const now = new Date();
    const startofWeek = new Date(now);

    //MONDAY IS FIRST DAY 
    const day = (now.getDay() + 6) % 7;

    startofWeek.setDate(now.getDate() - day);
    startofWeek.setHours(0,0,0,0);

    return studyData.sessions.filter(session => {
        const sessionDate = new Date(session.date);

        return !Number.isNaN(sessionDate.getTime()) && sessionDate >= startofWeek && sessionDate <= now;
    })
    .reduce((total, session) => total + session.duration, 0);
}

//UPDATE STUDY TRACKER
function refreshStudyTracker() {
    const todayMinutes = getTodayMinutes();
    const weekMinutes = getWeekMinutes();
    const goal = studyData.dailyGoal;

    todayTime.textContext = formatStudyTime(todayMinutes);
    weekTime.textContent = formatStudyTime(weekMinutes);

    dailyGoal.value = String(goal);
    goalLabel.textContent = formatStudyTime(goal);

    const goalPercentage = Math.min(
        100, 
        (todayMinutes / goal) * 100
    );

    goalProgressFill.computedStyleMap.width = `${goalPercentage}%`;

    if(todayMinutes >= goal) {
        goalMessage.textContent = "Daily goal achieved! Amazing work!";
    } else {
        goalMessage.textContent = `${formatStudyTime(goal - todayMinutes)} left to reach your goal.`;
    }

    renderStudyHistory();
}

//SHOW RECENT STUDY SESSIONS
function renderStudyHistory() {
    studyHistoryList.replaceChildren();

    const recentSessions = [...studyData.sessions].sort((a, b) => 
        new Date(b.date).getTime() - 
        new Date(a.date).getTime()
    )
    .slice(0, 10);

    if(recentSessions.length === 0) {
        const item = document.createElement("li");

        item.className = "empty-message";
        item.textContent = "No completed study sessions yet.";

        studyHistoryList.appendChild(item);
        return;
    }

    recentSessions.forEach(session => {
        const item = document.createElement("li");
        const date = new Data(session.date);

        item.textContent = `${date.toLocaleDateString()} - ` +
                            `${date.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                            })} - ${formatStudyTime(session.duration)}`;

                            studyHistoryList.appendChild(item);
    });
}

//DAILY STUDY GOAL
dailyGoal.addEventListener("input", () => {
    const newGoal = Number(dailyGoal.value);

    studyData.dailyGoal = newGoal;
    goalLabel.textContent = formatStudyTime(newGoal);

    saveStudyData();
    refreshStudyTracker();
});

//BUTTON EVENT LISTENERS
startButton.addEventListener("click", startTime);
pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", resetTimer);

modeButtons.forEach(button => {
    button.setAttribute(
        "aria-pressed",
        String(button.classList.contains("active"))
    );
    button.addEventListener("click", () => {
        selectMode(button.dataset.mode);
    });
});

//COMPLETION SOUND
function playCompletionSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if(!AudioContextClass) {
            return;
        }

        const AudioContext = new AudioContextClass();

        const oscillator = AudioContext.createOscillator();
        const gain = AudioContext.createGain();

        oscillator.connect(gain);
        gain.connect(AudioContext.destination);

        oscillator.frequency.value = 660;
        oscillator.type = "sine";

        gain.gain.setValueAtTime(
            0.15,
            AudioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            AudioContext.currentTime + 0.6
        );

        oscillator.start();
        oscillator.stop(AudioContext.currentTime + 0.6);

        oscillator.onended = () => {
            AudioContext.close();
        };
    } catch (error) {
        console.warn("Completion sound unavailable:", error);
    }
}

//INITIALIzE APP
updateTimerDisplay();
updateTimerStatus();
refreshStudyTracker();