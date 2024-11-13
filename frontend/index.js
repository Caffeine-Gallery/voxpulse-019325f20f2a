import { AuthClient } from "@dfinity/auth-client";
import { backend } from "declarations/backend";

let authClient;
let currentPrincipal = null;
let currentPollId = null;
let resultsChart = null;
let updateInterval = null;

// Initialize auth client
async function initAuth() {
    authClient = await AuthClient.create();
    if (await authClient.isAuthenticated()) {
        handleAuthenticated();
    }
    setupEventListeners();
    loadPublicPolls();
}

async function login() {
    await authClient.login({
        identityProvider: "https://identity.ic0.app/#authorize",
        onSuccess: handleAuthenticated,
    });
}

async function handleAuthenticated() {
    currentPrincipal = await authClient.getIdentity().getPrincipal();
    document.getElementById('loginBtn').textContent = 'Logout';
    document.getElementById('loginBtn').onclick = logout;
    document.getElementById('authSection').classList.remove('d-none');
    loadPublicPolls();
}

async function logout() {
    await authClient.logout();
    currentPrincipal = null;
    document.getElementById('loginBtn').textContent = 'Login';
    document.getElementById('loginBtn').onclick = login;
    document.getElementById('authSection').classList.add('d-none');
    loadPublicPolls();
}

// Navigation
function showView(viewId) {
    document.querySelectorAll('.view-content').forEach(view => view.classList.add('d-none'));
    document.getElementById(viewId).classList.remove('d-none');
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

function showHomeView() {
    showView('homeView');
    loadPublicPolls();
}

// Poll Management
async function loadPublicPolls() {
    const polls = await backend.getPublicPolls();
    const pollsList = document.getElementById('publicPollsList');
    pollsList.innerHTML = '';

    polls.forEach(poll => {
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-4';
        card.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${poll.question}</h5>
                    <p class="card-text">
                        <small class="text-muted">
                            Expires: ${new Date(Number(poll.expiresAt) / 1000000).toLocaleString()}
                        </small>
                    </p>
                    <button class="btn btn-primary" onclick="viewPoll(${poll.id})">
                        View Poll
                    </button>
                </div>
            </div>
        `;
        pollsList.appendChild(card);
    });
}

async function viewPoll(pollId) {
    currentPollId = pollId;
    const poll = await backend.getPoll(pollId);
    if (!poll) return;

    document.getElementById('pollDetailTitle').textContent = poll.question;
    
    if (poll.isPrivate) {
        document.getElementById('accessCodeSection').classList.remove('d-none');
        document.getElementById('pollContent').classList.add('d-none');
    } else {
        document.getElementById('accessCodeSection').classList.add('d-none');
        document.getElementById('pollContent').classList.remove('d-none');
        setupPollContent(poll);
    }

    showView('pollDetailView');
    if (!poll.isPrivate) {
        startResultsUpdate();
    }
}

function setupPollContent(poll) {
    // Setup voting section
    const votingSection = document.getElementById('votingSection');
    votingSection.innerHTML = poll.options.map(option => `
        <div class="form-check">
            <input class="form-check-input" type="${poll.isMultipleChoice ? 'checkbox' : 'radio'}"
                   name="pollOption" value="${option.id}" id="option${option.id}">
            <label class="form-check-label" for="option${option.id}">
                ${option.text}
            </label>
        </div>
    `).join('') + `
        <button class="btn btn-primary mt-3" onclick="submitVote()">Vote</button>
    `;

    updateResults();
    loadComments();
}

async function verifyAccess() {
    const accessCode = document.getElementById('accessCodeInput').value;
    const verified = await backend.verifyPollAccess(currentPollId, accessCode);
    if (verified) {
        const poll = await backend.getPoll(currentPollId);
        document.getElementById('accessCodeSection').classList.add('d-none');
        document.getElementById('pollContent').classList.remove('d-none');
        setupPollContent(poll);
        startResultsUpdate();
    } else {
        alert('Invalid access code');
    }
}

async function submitVote() {
    const selectedOptions = Array.from(document.querySelectorAll('input[name="pollOption"]:checked'))
        .map(input => parseInt(input.value));
    
    if (selectedOptions.length === 0) return;

    const poll = await backend.getPoll(currentPollId);
    const accessCode = poll.isPrivate ? document.getElementById('accessCodeInput').value : null;

    try {
        await backend.vote(currentPollId, selectedOptions, accessCode ? [accessCode] : []);
        updateResults();
    } catch (error) {
        console.error('Error submitting vote:', error);
    }
}

async function updateResults() {
    const poll = await backend.getPoll(currentPollId);
    const votes = await backend.getVotes(currentPollId);
    
    if (!poll || !votes) return;

    const ctx = document.getElementById('resultsChart').getContext('2d');
    
    if (resultsChart) {
        resultsChart.destroy();
    }

    resultsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: poll.options.map(opt => opt.text),
            datasets: [{
                label: 'Votes',
                data: poll.options.map(opt => {
                    return votes.reduce((count, vote) => 
                        count + (vote.optionIds.includes(opt.id) ? 1 : 0), 0);
                }),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function startResultsUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    updateInterval = setInterval(updateResults, 5000);
}

async function loadComments() {
    const comments = await backend.getComments(currentPollId);
    const commentsSection = document.getElementById('commentsSection');
    
    if (!comments) {
        commentsSection.innerHTML = '<p>No comments yet</p>';
        return;
    }

    commentsSection.innerHTML = comments.map(comment => `
        <div class="card mb-2">
            <div class="card-body">
                <p class="card-text">${comment.text}</p>
                <small class="text-muted">
                    ${new Date(Number(comment.timestamp) / 1000000).toLocaleString()}
                </small>
            </div>
        </div>
    `).join('');
}

async function addComment() {
    const text = document.getElementById('commentText').value.trim();
    if (!text) return;

    try {
        await backend.addComment(currentPollId, text);
        document.getElementById('commentText').value = '';
        loadComments();
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('loginBtn').onclick = login;
    document.getElementById('createPollBtn').onclick = createPoll;
    document.getElementById('addCommentBtn').onclick = addComment;
    document.getElementById('verifyAccessBtn').onclick = verifyAccess;
    document.getElementById('isPrivate').onchange = function() {
        document.getElementById('accessCodeContainer').classList.toggle('d-none', !this.checked);
    };
    
    document.getElementById('scanQrBtn').onclick = function() {
        const qrReader = document.getElementById('qrReader');
        qrReader.classList.toggle('d-none');
        if (!qrReader.classList.contains('d-none')) {
            const html5QrcodeScanner = new Html5QrcodeScanner(
                "qrReader", { fps: 10, qrbox: 250 });
            html5QrcodeScanner.render((decodedText) => {
                document.getElementById('accessCodeInput').value = decodedText;
                html5QrcodeScanner.clear();
                qrReader.classList.add('d-none');
                verifyAccess();
            });
        }
    };

    document.querySelectorAll('[data-view]').forEach(element => {
        element.onclick = () => showView(element.dataset.view);
    });
}

// Initialize
initAuth();
