// --- Configuration ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyP8pUo11_0qM5g2lbM4Pi5AuMwvfgZqrOnLLEBLCFgUrmzlkKLE8Ds3MPWfczplaU/exec';
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
        // Chiu waits passively for a call
        peer.on('call', call => {
            stopCountdown();
            call.answer(localStream);
            handleIncomingCall(call);
        });
    } else if (user === 'admin') {
        peer = new Peer(); // Admin gets a random ID
        statusMessage.textContent = "Ready to join the call when Chiu starts.";
        joinCallBtn.classList.remove('hidden');
    }
    
    peer.on('error', (err) => {
        console.error("PeerJS error:", err);
        alert(`A connection error occurred: ${err.type}. Please refresh the page.`);
    });
}

// --- Call Handling ---
function handleIncomingCall(call) {
    // Clean up any previous call objects
    if (currentCall) {
        currentCall.close();
    }
    currentCall = call;
    
    // UI changes for an active call
    initialControls.classList.add('hidden');
    callInProgressControls.classList.remove('hidden');

    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
    });

    call.on('close', () => {
        alert("The call has ended.");
        resetToInitialState();
    });

    call.on('error', (err) => {
        console.error("Call error:", err);
        alert("An error occurred during the call. Please refresh.");
        resetToInitialState();
    });
}

// --- Button Click Handlers ---
startCallBtn.addEventListener('click', () => {
    fetch(APPS_SCRIPT_URL + '?type=startcall')
        .catch(err => console.error("Error notifying admin:", err));
    
    statusMessage.textContent = "Waiting for admin to join...";
    startCallBtn.classList.add('hidden');
    startCountdown();
});

// --- NEW (IMPROVED) ADMIN JOIN LOGIC ---
joinCallBtn.addEventListener('click', () => {
    statusMessage.textContent = "Searching for Chiu... Please wait.";
    joinCallBtn.classList.add('hidden');

    // Clear any old retry timers or counts
    if (window.retryTimeout) clearTimeout(window.retryTimeout);
    delete window.retryCount;

    const attemptCall = () => {
        // Stop if a call is already connected
        if (currentCall && currentCall.open) return;

        console.log("Attempting to call Chiu...");
        const call = peer.call(CHIU_PEER_ID, localStream);

        // This event fires when the connection is successful
        call.on('stream', () => {
            console.log("Call connected successfully!");
            if (window.retryTimeout) clearTimeout(window.retryTimeout);
            delete window.retryCount;
        });

        // This event fires if the peer is not available
        call.on('error', (err) => {
            console.warn(`Call failed: ${err.type}. Retrying in 5 seconds.`);
            statusMessage.textContent = "Friend is not online yet... Retrying.";
            
            if (!window.retryCount) window.retryCount = 0;
            window.retryCount++;
            
            // Try for 1 minute (12 attempts * 5 seconds)
            if (window.retryCount > 12) {
                statusMessage.textContent = "Could not connect. Ask Chiu to start the call, then click Join again.";
                joinCallBtn.classList.remove('hidden');
                clearTimeout(window.retryTimeout);
                delete window.retryCount;
                return;
            }

            // Schedule the next retry
            window.retryTimeout = setTimeout(attemptCall, 5000);
        });

        // Handle the call object immediately
        handleIncomingCall(call);
    };

    // Start the first attempt
    attemptCall();
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
    if (window.retryTimeout) clearTimeout(window.retryTimeout);
    delete window.retryCount;

    if (currentCall) currentCall.close();
    if (peer) peer.destroy();
    sessionStorage.removeItem('user');
    window.location.href = 'index.html';
}

window.addEventListener('beforeunload', resetToInitialState);
