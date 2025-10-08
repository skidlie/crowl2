// --- Configuration ---
const APPS_SCRIPT_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
const CHIU_PEER_ID = 'chiu-video-call-peer-a9b8c7d6e5f4';

// --- Get HTML Elements ---
const initialControls = document.getElementById('initial-controls');
const callInProgressControls = document.getElementById('call-in-progress-controls');
const welcomeMessage = document.getElementById('welcome-message');
const startCallBtn = document.getElementById('start-call-btn');
const joinCallBtn = document.getElementById('join-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const statusMessage = document.getElementById('status-message');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const timerContainer = document.getElementById('timer-container');
const countdownEl = document.getElementById('countdown');

// --- Global Variables ---
let user;
let localStream;
let peer;
let currentCall;
let countdownInterval;

// --- Main Initialization on Page Load ---
window.onload = async () => {
    user = sessionStorage.getItem('user');
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    welcomeMessage.textContent = `Welcome, ${user}!`;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (error) {
        alert("You must allow access to your camera and microphone.");
        return;
    }

    initializePeer();
};

function initializePeer() {
    if (user === 'chiu') {
        peer = new Peer(CHIU_PEER_ID);
        statusMessage.textContent = "Ready to start a call.";
        startCallBtn.classList.remove('hidden');
        peer.on('call', call => {
            stopCountdown();
            call.answer(localStream);
            handleIncomingCall(call);
        });
    } else if (user === 'admin') {
        peer = new Peer();
        statusMessage.textContent = "Waiting for your friend to start a call...";
        joinCallBtn.classList.remove('hidden');
    }
    
    peer.on('error', (err) => {
        console.error("PeerJS error:", err);
        alert("Could not connect. Please refresh and try again.");
    });
}

// --- Call Handling ---
function handleIncomingCall(call) {
    currentCall = call;
    // Hide initial controls and show the end call button
    initialControls.classList.add('hidden');
    callInProgressControls.classList.remove('hidden');

    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
    });

    call.on('close', () => {
        alert("The other user has ended the call.");
        resetToInitialState();
    });
}

// --- Button Click Handlers ---
startCallBtn.addEventListener('click', () => {
    fetch(APPS_SCRIPT_URL + '?type=startcall')
        .catch(err => console.error("Error notifying admin:", err));
    
    statusMessage.textContent = "Notified admin. Waiting for them to join...";
    startCallBtn.classList.add('hidden');
    startCountdown();
});

joinCallBtn.addEventListener('click', () => {
    const call = peer.call(CHIU_PEER_ID, localStream);
    handleIncomingCall(call);
});

endCallBtn.addEventListener('click', () => {
    if (currentCall) currentCall.close();
    resetToInitialState();
});

// --- Helper Functions ---
function startCountdown() {
    timerContainer.classList.remove('hidden');
    let duration = 5 * 60;
    setTimeout(() => {
        if (countdownInterval) {
            alert("Please wait 60 seconds. The admin has been notified.");
        }
    }, 60 * 1000);
    countdownInterval = setInterval(() => {
        duration--;
        let minutes = Math.floor(duration / 60);
        let seconds = duration % 60;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        countdownEl.textContent = `${minutes}:${seconds}`;
        if (duration <= 0) {
            alert("Admin did not join in time.");
            resetToInitialState();
        }
    }, 1000);
}

function stopCountdown() {
    clearInterval(countdownInterval);
    countdownInterval = null;
    timerContainer.classList.add('hidden');
}

function resetToInitialState() {
    if (currentCall) currentCall.close();
    if (peer) peer.destroy();
    sessionStorage.removeItem('user');
    window.location.href = 'index.html';
}

window.addEventListener('beforeunload', resetToInitialState);