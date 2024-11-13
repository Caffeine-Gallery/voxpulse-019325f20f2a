import { AuthClient } from "@dfinity/auth-client";
import { backend } from "declarations/backend";

let authClient;
let currentPrincipal = null;
let currentPollId = null;

// Initialize auth client
async function initAuth() {
    authClient = await AuthClient.create();
    if (await authClient.isAuthenticated()) {
        handleAuthenticated();
    }
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
    loadPolls();
}

async function logout() {
    await authClient.logout();
    currentPrincipal = null;
    document.getElementById('loginBtn').textContent = 'Login';
    document.getElementById('loginBtn').onclick = login;
    document.getElementById('authSection').classList.add('d-none');
    document.getElementById('pollsList').innerHTML = '';
}

// Poll Management
async function createPoll() {
    const question = document.getElementById('pollQuestion').value;
    const options = Array.from(document.getElementsByClassName('option-input'))
        .map(input => input.value);
    const isPrivate = document.getElementById('isPrivate').checked;
    const isMultipleChoice = document.getElementById('isMultipleChoice').checked;
    const expirationSeconds = parseInt(document.getElementById('pollExpiration').value);
    const expiresAt = BigInt(Date.now() + (expirationSeconds * 1000)) * BigInt(1000000);

    try {
        await backend.createPoll(question, options, isPrivate, isMultipleChoice, expiresAt);
        bootstrap.Modal.getInstance(document.getElementById('createPollModal')).hide();
        loadPolls();
    } catch (error) {
        console.error('Error creating poll:', error);
    }
}

async function loadPolls() {
    const polls = await backend.getAllPolls();
    const pollsList = document.getElementById('pollsList');
    pollsList.innerHTML = '';

    polls.forEach(poll => {
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-4';
        card.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">${poll.question}</h5>
                    <p class="card-text">
                        ${poll.options.length} options · 
                        ${poll.isPrivate ? 'Private' : 'Public'} ·
                        ${poll.isMultipleChoice ? 'Multiple choice' : 'Single choice'}
                    </p>
                    <button class="btn btn-primary view-poll" data-poll-id="${poll.id}">
                        View Poll
                    </button>
                </div>
            </div>
        `;
        pollsList.appendChild(card);
    });

    document.querySelectorAll('.view-poll').forEach(button => {
        button.onclick = () => viewPoll(parseInt(button.dataset.pollId));
    });
}

async function viewPoll(pollId) {
    currentPollId = pollId;
    const poll = await backend.getPoll(pollId);
    if (!poll) return;

    document.getElementById('pollTitle').textContent = poll.question;
    
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
    `).join('');
    
    // Add vote button
    votingSection.innerHTML += `
        <button class="btn btn-primary mt-3" id="submitVoteBtn">Vote</button>
    `;
    document.getElementById('submitVoteBtn').onclick = () => submitVote(pollId);

    // Generate QR Code
    const qrCodeSection = document.getElementById('qrCodeSection');
    const pollUrl = `${window.location.origin}?poll=${pollId}`;
    QRCode.toCanvas(qrCodeSection, pollUrl);

    // Load and display results
    updateResults(pollId);
    loadComments(pollId);

    // Show modal
    new bootstrap.Modal(document.getElementById('viewPollModal')).show();
}

async function submitVote(pollId) {
    const selectedOptions = Array.from(document.querySelectorAll('input[name="pollOption"]:checked'))
        .map(input => parseInt(input.value));
    
    if (selectedOptions.length === 0) return;

    try {
        await backend.vote(pollId, selectedOptions);
        updateResults(pollId);
    } catch (error) {
        console.error('Error submitting vote:', error);
    }
}

async function updateResults(pollId) {
    const poll = await backend.getPoll(pollId);
    const votes = await backend.getVotes(pollId);
    
    if (!poll || !votes) return;

    const ctx = document.getElementById('resultsChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: poll.options.map(opt => opt.text),
            datasets: [{
                label: 'Votes',
                data: poll.options.map(opt => {
                    return votes.reduce((count, vote) => 
                        count + (vote.optionIds.includes(opt.id) ? 1 : 0), 0);
                }),
                backgroundColor: 'rgba(54, 162, 235, 0.5)'
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

async function loadComments(pollId) {
    const comments = await backend.getComments(pollId);
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
    if (!text || !currentPollId) return;

    try {
        await backend.addComment(currentPollId, text);
        document.getElementById('commentText').value = '';
        loadComments(currentPollId);
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

// Event Listeners
document.getElementById('loginBtn').onclick = login;
document.getElementById('createPollBtn').onclick = createPoll;
document.getElementById('addCommentBtn').onclick = addComment;
document.getElementById('addOptionBtn').onclick = () => {
    const container = document.getElementById('optionsContainer');
    const input = document.createElement('div');
    input.className = 'mb-3';
    input.innerHTML = `
        <input type="text" class="form-control option-input" required>
    `;
    container.appendChild(input);
};

// Initialize
initAuth();
