require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Game = require('./models/Game');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 4000;
//MOGOOSE CONNECTION
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected');
    })
    .catch((error) => {
        console.log(
            'MongoDB connection error:',
            error.message
        );
    });

let players = [];
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameStarted = false;
let gameOver = false;
//WINNER CHECK CODE
function checkWinner() {
    const combinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const combination of combinations) {
        const [a, b, c] = combination;

        if (
            board[a] !== '' &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    return null;
}

function checkDraw() {
    return board.every((cell) => cell !== '');
}

function sendGameState(status) {
    io.emit('gameState', {
        board: board,
        status: status
    });
}

async function saveGame(winner, result) {
    const playerX = players.find(
        (player) => player.symbol === 'X'
    );

    const playerO = players.find(
        (player) => player.symbol === 'O'
    );

    if (!playerX || !playerO) {
        console.log(
            'Players not found. Game not saved.'
        );

        return;
    }

    try {
        const game = new Game({
            playerX: playerX.username,
            playerO: playerO.username,
            winner: winner,
            result: result,
            board: [...board]
        });

        await game.save();

        console.log('Game saved successfully');
    } catch (error) {
        console.log(
            'Error saving game:',
            error.message
        );
    }
}

function resetGameState() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameStarted = players.length === 2;
    gameOver = false;
}

io.on('connection', (socket) => {
    console.log(
        'Player connected:',
        socket.id
    );

    socket.on('joinGame', (username) => {
        if (players.length >= 2) {
            socket.emit('gameFull');
            return;
        }

        const symbol =
            players.length === 0 ? 'X' : 'O';

        const player = {
            socketId: socket.id,
            username: username,
            symbol: symbol
        };

        players.push(player);

        socket.emit(
            'playerAssigned',
            symbol
        );

        console.log(
            `${username} joined as Player ${symbol}`
        );

        if (players.length === 1) {
            socket.emit('gameState', {
                board: board,
                status:
                    'Waiting for another player...'
            });
        }

        if (players.length === 2) {
            gameStarted = true;
            gameOver = false;
            currentPlayer = 'X';

            sendGameState(
                'Game started. Player X goes first.'
            );
        }
    });

    socket.on('makeMove', async (data) => {
        if (!gameStarted || gameOver) {
            return;
        }

        const player = players.find(
            (item) =>
                item.socketId === socket.id
        );

        if (!player) {
            return;
        }

        if (player.symbol !== currentPlayer) {
            socket.emit(
                'invalidMove',
                'It is not your turn.'
            );

            return;
        }

        const index = Number(data.index);

        if (
            Number.isNaN(index) ||
            index < 0 ||
            index > 8
        ) {
            return;
        }

        if (board[index] !== '') {
            socket.emit(
                'invalidMove',
                'This cell is already occupied.'
            );

            return;
        }

        board[index] = player.symbol;

        const winner = checkWinner();

        if (winner) {
            gameOver = true;

            sendGameState(
                `${player.username} wins! Player ${winner} is the winner.`
            );

            await saveGame(
                player.username,
                'win'
            );

            io.emit('gameFinished');

            return;
        }

        if (checkDraw()) {
            gameOver = true;

            sendGameState(
                'Game ended in a draw.'
            );

            await saveGame(
                null,
                'draw'
            );

            io.emit('gameFinished');

            return;
        }

        currentPlayer =
            currentPlayer === 'X'
                ? 'O'
                : 'X';

        const nextPlayer = players.find(
            (item) =>
                item.symbol === currentPlayer
        );

        sendGameState(
            `${nextPlayer.username}'s turn. Player ${currentPlayer}.`
        );
    });

    socket.on('resetGame', () => {
        if (players.length < 2) {
            return;
        }

        resetGameState();

        sendGameState(
            'Game reset. Player X goes first.'
        );
    });

    socket.on('disconnect', () => {
        console.log(
            'Player disconnected:',
            socket.id
        );

        players = players.filter(
            (player) =>
                player.socketId !== socket.id
        );

        resetGameState();

        io.emit(
            'playerDisconnected',
            'The other player disconnected.'
        );
    });
});

app.get('/api/games', async (request, response) => {
    try {
        const games = await Game.find()
            .sort({ playedAt: -1 })
            .limit(20)
            .lean();

        response.status(200).json(games);
    } catch (error) {
        console.log(
            'History error:',
            error.message
        );

        response.status(500).json({
            message:
                'Unable to load game history'
        });
    }
});

app.get('/', (request, response) => {
    response.sendFile(
        __dirname + '/public/index.html'
    );
});

server.listen(PORT, () => {
    console.log(
        `Server running on port ${PORT}`
    );
});