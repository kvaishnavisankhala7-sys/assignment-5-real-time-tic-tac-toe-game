const socket = io();

const loginScreen =
    document.getElementById('login-screen');
//LOGIN SCREEN
const gameScreen =
    document.getElementById('game-screen');
//USERNAME
const usernameInput =
    document.getElementById('username');

const joinButton =
    document.getElementById('join-btn');

const loginMessage =
    document.getElementById('login-message');
//PLAYERINFO
const playerInfo =
    document.getElementById('player-info');

const gameStatus =
    document.getElementById('game-status');

const cells =
    document.querySelectorAll('.cell');

const resetButton =
    document.getElementById('reset-btn');
//TOGGLE THEME
const themeToggle =
    document.getElementById('theme-toggle');

const gameHistory =
    document.getElementById('game-history');

let player = null;
let username = '';

const savedTheme =
    localStorage.getItem('theme');

if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    themeToggle.textContent = 'Light';
} else {
    themeToggle.textContent = 'Dark';
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');

    const isDark =
        document.body.classList.contains('dark');

    localStorage.setItem(
        'theme',
        isDark ? 'dark' : 'light'
    );

    themeToggle.textContent =
        isDark ? 'Light' : 'Dark';
});

joinButton.addEventListener('click', () => {
    username =
        usernameInput.value.trim();

    if (username === '') {
        loginMessage.textContent =
            'Please enter a username';

        return;
    }

    socket.emit(
        'joinGame',
        username
    );
});

usernameInput.addEventListener(
    'keypress',
    (event) => {
        if (event.key === 'Enter') {
            joinButton.click();
        }
    }
);

cells.forEach((cell) => {
    cell.addEventListener(
        'click',
        () => {
            if (!player) {
                return;
            }

            const index =
                Number(cell.dataset.index);

            socket.emit(
                'makeMove',
                {
                    index: index,
                    player: player
                }
            );
        }
    );
});

resetButton.addEventListener(
    'click',
    () => {
        socket.emit('resetGame');
    }
);

socket.on(
    'playerAssigned',
    (assignedPlayer) => {
        player = assignedPlayer;

        loginScreen.classList.add(
            'hidden'
        );

        gameScreen.classList.remove(
            'hidden'
        );

        playerInfo.textContent =
            `You are Player ${player}`;

        loadGameHistory();
    }
);

socket.on(
    'gameFull',
    () => {
        loginMessage.textContent =
            'Game is full. Please wait for a player to leave.';
    }
);

socket.on(
    'gameState',
    (game) => {
        game.board.forEach(
            (value, index) => {
                cells[index].textContent =
                    value;
            }
        );

        gameStatus.textContent =
            game.status;
    }
);

socket.on(
    'invalidMove',
    (message) => {
        gameStatus.textContent =
            message;
    }
);

socket.on(
    'gameFinished',
    () => {
        setTimeout(
            loadGameHistory,
            300
        );
    }
);

socket.on(
    'gameReset',
    () => {
        cells.forEach(
            (cell) => {
                cell.textContent = '';
            }
        );

        gameStatus.textContent =
            'Game reset. Player X goes first.';
    }
);

socket.on(
    'playerDisconnected',
    (message) => {
        gameStatus.textContent =
            message;
    }
);

async function loadGameHistory() {
    try {
        const response =
            await fetch('/api/games');

        if (!response.ok) {
            throw new Error(
                'History request failed'
            );
        }

        const games =
            await response.json();

        if (
            !Array.isArray(games) ||
            games.length === 0
        ) {
            gameHistory.innerHTML =
                '<p>No games played yet.</p>';

            return;
        }

        gameHistory.innerHTML = '';

        games.forEach(
            (game) => {
                const historyItem =
                    document.createElement(
                        'div'
                    );

                historyItem.className =
                    'history-item';

                const players =
                    document.createElement(
                        'p'
                    );

                players.innerHTML =
                    `<strong>${game.playerX}</strong> vs <strong>${game.playerO}</strong>`;

                const result =
                    document.createElement(
                        'p'
                    );

                if (
                    game.result === 'draw'
                ) {
                    result.textContent =
                        'Result: Draw';
                } else {
                    result.textContent =
                        `Winner: ${game.winner}`;
                }

                const date =
                    document.createElement(
                        'p'
                    );

                date.textContent =
                    new Date(
                        game.playedAt
                    ).toLocaleString();

                historyItem.appendChild(
                    players
                );

                historyItem.appendChild(
                    result
                );

                historyItem.appendChild(
                    date
                );

                gameHistory.appendChild(
                    historyItem
                );
            }
        );
    } catch (error) {
        console.log(
            'Error loading history:',
            error
        );

        gameHistory.innerHTML =
            '<p>Unable to load game history.</p>';
    }
}