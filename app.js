// Piko Přepadení - PWA Game
let game = null;

// Game constants
const GAME_CONFIG = {
    WIDTH: 390,
    HEIGHT: 844,
    PLAYER_SPEED: 5,
    JUMP_POWER: 15,
    GRAVITY: 0.8,
    SPAWN_RATE: 0.02,
    COLLECTIBLE_RATE: 0.015
};

// Czech game content
const GAME_CONTENT = {
    quotes: {
        start: ['Jdeme na to, kámo!', 'Dneska to bude jízda!', 'Čas na akci!'],
        collect: ['Dobrý matroš!', 'Tohle zachrání večer!', 'Perfektní!'],
        damage: ['Prásknul ses!', 'Tohle bolí víc než absťák!', 'Ouch!'],
        gameOver: ['Chytli tě, šlehaři!', 'Příště běž jinudy!', 'Konec hry!'],
        events: ['Motá se fízl!', 'Dealer je offline!', 'Spadlo ti cévko!']
    },
    powerUps: {
        speed: { name: 'Rychlý šleh', icon: '⚡', duration: 5000 },
        invincibility: { name: 'Neviditelnost', icon: '👻', duration: 3000 },
        health: { name: 'Extra cévko', icon: '💉', duration: 0 }
    }
};

class Game {
    constructor() {
        console.log('Game initializing...');
        
        // Game state
        this.state = 'loading';
        this.score = 0;
        this.health = 100;
        this.distance = 0;
        this.speed = 2;
        this.startTime = 0;
        
        // Game objects
        this.player = {
            x: 195,
            y: 600,
            width: 30,
            height: 40,
            targetX: 195,
            isJumping: false,
            jumpHeight: 0,
            jumpSpeed: 0,
            maxJumpHeight: 150,
            invincible: false
        };
        
        this.obstacles = [];
        this.collectibles = [];
        this.enemies = [];
        this.particles = [];
        this.powerUps = new Map();
        
        // Canvas
        this.canvas = null;
        this.ctx = null;
        this.gameLoop = null;
        this.lastTime = 0;
        
        // Settings
        this.settings = {
            sound: true,
            vibration: true,
            difficulty: 'normal'
        };
        
        // Data
        this.highScores = [];
        this.achievements = [
            { id: 'first_run', title: 'První útěk', description: 'Začni svůj první run', icon: '🏃', unlocked: false },
            { id: 'collector', title: 'Sběratel', description: 'Sebirej 50 "matroše"', icon: '💊', unlocked: false, progress: 0, target: 50 },
            { id: 'survivor', title: 'Přežil jsem', description: 'Doběhni 1000 metrů', icon: '🏃‍♂️', unlocked: false },
            { id: 'speedster', title: 'Rychlík', description: 'Aktivuj 10 speed boostů', icon: '⚡', unlocked: false, progress: 0, target: 10 },
            { id: 'untouchable', title: 'Nedotknutelný', description: 'Doběhni 500m bez poškození', icon: '🛡️', unlocked: false },
            { id: 'high_score', title: 'Rekordman', description: 'Získej skóre vyšší než 10,000', icon: '👑', unlocked: false }
        ];
        
        this.init();
    }
    
    init() {
        this.loadData();
        this.setupAudio();
        
        // Show loading screen
        setTimeout(() => {
            this.showScreen('start-screen');
            this.setupEvents();
        }, 2000);
    }
    
    setupEvents() {
        console.log('Setting up events...');
        
        // Button events
        const buttons = [
            ['play-btn', () => this.startGame()],
            ['settings-btn', () => this.showScreen('settings-screen')],
            ['scores-btn', () => this.showScreen('scores-screen')],
            ['achievements-btn', () => this.showScreen('achievements-screen')],
            ['restart-btn', () => this.startGame()],
            ['menu-btn', () => this.showScreen('start-screen')],
            ['pause-btn', () => this.pauseGame()],
            ['resume-btn', () => this.resumeGame()],
            ['pause-menu-btn', () => this.endGame()],
            ['back-from-settings-btn', () => this.showScreen('start-screen')],
            ['back-from-scores-btn', () => this.showScreen('start-screen')],
            ['back-from-achievements-btn', () => this.showScreen('start-screen')],
            ['reset-data-btn', () => this.resetData()]
        ];
        
        buttons.forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.playSound('click');
                    this.vibrate(50);
                    handler();
                });
            }
        });
        
        // Settings
        this.setupSettingsEvents();
        
        // Touch events for game
        this.setupTouchEvents();
        
        // Keyboard events
        this.setupKeyboardEvents();
        
        console.log('Events setup complete');
    }
    
    setupSettingsEvents() {
        const soundToggle = document.getElementById('sound-toggle');
        const vibrationToggle = document.getElementById('vibration-toggle');
        const difficultySelect = document.getElementById('difficulty-select');
        
        if (soundToggle) {
            soundToggle.checked = this.settings.sound;
            soundToggle.addEventListener('change', () => {
                this.settings.sound = soundToggle.checked;
                this.saveData();
            });
        }
        
        if (vibrationToggle) {
            vibrationToggle.checked = this.settings.vibration;
            vibrationToggle.addEventListener('change', () => {
                this.settings.vibration = vibrationToggle.checked;
                this.saveData();
            });
        }
        
        if (difficultySelect) {
            difficultySelect.value = this.settings.difficulty;
            difficultySelect.addEventListener('change', () => {
                this.settings.difficulty = difficultySelect.value;
                this.saveData();
            });
        }
    }
    
    setupTouchEvents() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            if (this.state !== 'playing') return;
            
            e.preventDefault();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            if (this.state !== 'playing') return;
            
            e.preventDefault();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            const minSwipeDistance = 50;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (Math.abs(deltaX) > minSwipeDistance) {
                    if (deltaX > 0) {
                        this.movePlayer('right');
                    } else {
                        this.movePlayer('left');
                    }
                }
            } else {
                // Vertical swipe
                if (Math.abs(deltaY) > minSwipeDistance) {
                    if (deltaY < 0) {
                        this.jump();
                    } else {
                        this.slide();
                    }
                }
            }
        }, { passive: false });
        
        // Prevent scrolling
        document.addEventListener('touchmove', (e) => {
            if (this.state === 'playing') {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (this.state !== 'playing') return;
            
            switch(e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.movePlayer('left');
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.movePlayer('right');
                    break;
                case 'ArrowUp':
                case 'KeyW':
                case 'Space':
                    this.jump();
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.slide();
                    break;
                case 'Escape':
                    this.pauseGame();
                    break;
            }
        });
    }
    
    startGame() {
        console.log('Starting game...');
        
        this.state = 'playing';
        this.score = 0;
        this.health = 100;
        this.distance = 0;
        this.speed = 2;
        this.startTime = Date.now();
        
        // Reset player
        this.player = {
            x: 195,
            y: 600,
            width: 30,
            height: 40,
            targetX: 195,
            isJumping: false,
            jumpHeight: 0,
            jumpSpeed: 0,
            maxJumpHeight: 150,
            invincible: false
        };
        
        // Clear arrays
        this.obstacles = [];
        this.collectibles = [];
        this.enemies = [];
        this.particles = [];
        this.powerUps.clear();
        
        // Setup canvas
        this.setupCanvas();
        
        // Show game screen
        this.showScreen('game-screen');
        
        // Start game loop
        this.startGameLoop();
        
        // Show start message
        this.showMessage(this.getRandomQuote('start'));
        
        // Achievement: First run
        this.unlockAchievement('first_run');
        
        this.playSound('start');
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = GAME_CONFIG.WIDTH;
        this.canvas.height = GAME_CONFIG.HEIGHT;
    }
    
    startGameLoop() {
        const loop = (timestamp) => {
            if (this.state !== 'playing') return;
            
            const deltaTime = timestamp - this.lastTime;
            this.lastTime = timestamp;
            
            this.update(deltaTime);
            this.render();
            
            this.gameLoop = requestAnimationFrame(loop);
        };
        
        this.gameLoop = requestAnimationFrame(loop);
    }
    
    update(deltaTime) {
        // Update distance and score
        this.distance += this.speed;
        this.score += Math.floor(this.speed);
        
        // Increase difficulty
        if (this.distance > 0 && this.distance % 500 === 0) {
            this.speed += 0.5;
            this.showMessage('Rychleji!');
        }
        
        // Update player
        this.updatePlayer();
        
        // Spawn objects
        this.spawnObjects();
        
        // Update objects
        this.updateObjects();
        
        // Check collisions
        this.checkCollisions();
        
        // Update power-ups
        this.updatePowerUps();
        
        // Update UI
        this.updateUI();
        
        // Check achievements
        this.checkAchievements();
        
        // Check game over
        if (this.health <= 0) {
            this.endGame();
        }
    }
    
    updatePlayer() {
        // Smooth movement to target
        const moveSpeed = 8;
        if (this.player.x < this.player.targetX) {
            this.player.x = Math.min(this.player.x + moveSpeed, this.player.targetX);
        } else if (this.player.x > this.player.targetX) {
            this.player.x = Math.max(this.player.x - moveSpeed, this.player.targetX);
        }
        
        // Jumping
        if (this.player.isJumping) {
            this.player.jumpHeight += this.player.jumpSpeed;
            this.player.jumpSpeed -= GAME_CONFIG.GRAVITY;
            
            if (this.player.jumpHeight <= 0) {
                this.player.jumpHeight = 0;
                this.player.jumpSpeed = 0;
                this.player.isJumping = false;
            }
        }
    }
    
    spawnObjects() {
        // Spawn obstacles
        if (Math.random() < GAME_CONFIG.SPAWN_RATE * (this.speed / 2)) {
            this.spawnObstacle();
        }
        
        // Spawn collectibles
        if (Math.random() < GAME_CONFIG.COLLECTIBLE_RATE) {
            this.spawnCollectible();
        }
        
        // Spawn enemies
        if (Math.random() < 0.005 * (this.speed / 3)) {
            this.spawnEnemy();
        }
    }
    
    spawnObstacle() {
        const types = ['car', 'construction', 'bird'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        this.obstacles.push({
            x: GAME_CONFIG.WIDTH + Math.random() * 100,
            y: type === 'bird' ? 400 + Math.random() * 200 : 700,
            width: type === 'bird' ? 25 : 60,
            height: type === 'bird' ? 20 : 40,
            type: type,
            color: type === 'car' ? '#ff4757' : type === 'construction' ? '#ffa726' : '#795548'
        });
    }
    
    spawnCollectible() {
        const types = ['drugs', 'health', 'boost'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        this.collectibles.push({
            x: GAME_CONFIG.WIDTH + Math.random() * 100,
            y: 500 + Math.random() * 200,
            width: 20,
            height: 20,
            type: type,
            color: type === 'drugs' ? '#00f6ff' : type === 'health' ? '#66bb6a' : '#a855f7',
            pulse: 0
        });
    }
    
    spawnEnemy() {
        this.enemies.push({
            x: GAME_CONFIG.WIDTH + 50,
            y: 650,
            width: 35,
            height: 45,
            speed: this.speed + 1,
            color: '#ff6b6b'
        });
    }
    
    updateObjects() {
        // Update obstacles
        this.obstacles = this.obstacles.filter(obstacle => {
            obstacle.x -= this.speed;
            return obstacle.x > -obstacle.width;
        });
        
        // Update collectibles
        this.collectibles = this.collectibles.filter(collectible => {
            collectible.x -= this.speed;
            collectible.pulse += 0.2;
            return collectible.x > -collectible.width;
        });
        
        // Update enemies
        this.enemies = this.enemies.filter(enemy => {
            enemy.x -= enemy.speed;
            return enemy.x > -enemy.width;
        });
        
        // Update particles
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 1;
            return particle.life > 0;
        });
    }
    
    checkCollisions() {
        if (this.player.invincible) return;
        
        // Check obstacles
        this.obstacles.forEach(obstacle => {
            if (this.isColliding(this.player, obstacle)) {
                this.takeDamage(20);
                this.showMessage(this.getRandomQuote('damage'));
                this.createParticles(obstacle.x, obstacle.y, '#ff4757');
            }
        });
        
        // Check enemies
        this.enemies.forEach(enemy => {
            if (this.isColliding(this.player, enemy)) {
                this.takeDamage(30);
                this.showMessage('Chytil tě fízl!');
                this.createParticles(enemy.x, enemy.y, '#ff6b6b');
            }
        });
        
        // Check collectibles
        this.collectibles = this.collectibles.filter(collectible => {
            if (this.isColliding(this.player, collectible)) {
                this.collectItem(collectible);
                this.createParticles(collectible.x, collectible.y, collectible.color);
                return false;
            }
            return true;
        });
    }
    
    isColliding(a, b) {
        const playerY = this.player.y - this.player.jumpHeight;
        
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               playerY < b.y + b.height &&
               playerY + a.height > b.y;
    }
    
    collectItem(collectible) {
        switch(collectible.type) {
            case 'drugs':
                this.score += 100;
                this.showMessage(this.getRandomQuote('collect'));
                this.updateAchievementProgress('collector', 1);
                break;
                
            case 'health':
                this.health = Math.min(100, this.health + 20);
                this.showMessage('Zdraví obnoveno!');
                break;
                
            case 'boost':
                this.activatePowerUp('speed');
                this.showMessage('Speed boost!');
                this.updateAchievementProgress('speedster', 1);
                break;
        }
        
        this.playSound('collect');
    }
    
    activatePowerUp(type) {
        const config = GAME_CONTENT.powerUps[type];
        if (!config) return;
        
        this.powerUps.set(type, {
            name: config.name,
            icon: config.icon,
            endTime: Date.now() + config.duration
        });
        
        switch(type) {
            case 'speed':
                this.speed *= 1.5;
                break;
            case 'invincibility':
                this.player.invincible = true;
                break;
            case 'health':
                this.health = Math.min(100, this.health + 30);
                break;
        }
    }
    
    updatePowerUps() {
        const now = Date.now();
        
        this.powerUps.forEach((powerUp, type) => {
            if (now >= powerUp.endTime) {
                this.powerUps.delete(type);
                
                switch(type) {
                    case 'speed':
                        this.speed /= 1.5;
                        break;
                    case 'invincibility':
                        this.player.invincible = false;
                        break;
                }
            }
        });
    }
    
    createParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: color,
                life: 30
            });
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        this.playSound('damage');
        this.vibrate(200);
        
        // Screen shake effect
        if (this.canvas) {
            this.canvas.style.transform = 'translateX(5px)';
            setTimeout(() => {
                this.canvas.style.transform = '';
            }, 100);
        }
    }
    
    movePlayer(direction) {
        const lanes = [130, 195, 260]; // Three lanes
        const currentLane = lanes.findIndex(lane => Math.abs(this.player.targetX - lane) < 10);
        
        if (direction === 'left' && currentLane > 0) {
            this.player.targetX = lanes[currentLane - 1];
            this.playSound('move');
        } else if (direction === 'right' && currentLane < lanes.length - 1) {
            this.player.targetX = lanes[currentLane + 1];
            this.playSound('move');
        }
    }
    
    jump() {
        if (!this.player.isJumping) {
            this.player.isJumping = true;
            this.player.jumpSpeed = GAME_CONFIG.JUMP_POWER;
            this.playSound('jump');
        }
    }
    
    slide() {
        // TODO: Implement slide mechanic
        this.playSound('slide');
    }
    
    render() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.fillStyle = 'linear-gradient(to bottom, #1a202c, #2d3748)';
        this.ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
        
        // Draw background elements
        this.drawBackground();
        
        // Draw game objects
        this.drawObstacles();
        this.drawCollectibles();
        this.drawEnemies();
        this.drawPlayer();
        this.drawParticles();
    }
    
    drawBackground() {
        // Draw road lanes
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([20, 20]);
        
        [162.5, 227.5].forEach(x => {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, GAME_CONFIG.HEIGHT);
            this.ctx.stroke();
        });
        
        this.ctx.setLineDash([]);
    }
    
    drawPlayer() {
        const playerY = this.player.y - this.player.jumpHeight;
        
        this.ctx.fillStyle = this.player.invincible ? 
            'rgba(0, 246, 255, 0.5)' : '#00f6ff';
        
        this.ctx.fillRect(
            this.player.x - this.player.width / 2,
            playerY - this.player.height,
            this.player.width,
            this.player.height
        );
        
        // Player glow effect
        if (this.player.invincible) {
            this.ctx.shadowColor = '#00f6ff';
            this.ctx.shadowBlur = 20;
            this.ctx.fillRect(
                this.player.x - this.player.width / 2,
                playerY - this.player.height,
                this.player.width,
                this.player.height
            );
            this.ctx.shadowBlur = 0;
        }
    }
    
    drawObstacles() {
        this.obstacles.forEach(obstacle => {
            this.ctx.fillStyle = obstacle.color;
            this.ctx.fillRect(
                obstacle.x - obstacle.width / 2,
                obstacle.y - obstacle.height,
                obstacle.width,
                obstacle.height
            );
        });
    }
    
    drawCollectibles() {
        this.collectibles.forEach(collectible => {
            const scale = 1 + Math.sin(collectible.pulse) * 0.2;
            const size = collectible.width * scale;
            
            this.ctx.fillStyle = collectible.color;
            this.ctx.fillRect(
                collectible.x - size / 2,
                collectible.y - size / 2,
                size,
                size
            );
            
            // Glow effect
            this.ctx.shadowColor = collectible.color;
            this.ctx.shadowBlur = 15;
            this.ctx.fillRect(
                collectible.x - size / 2,
                collectible.y - size / 2,
                size,
                size
            );
            this.ctx.shadowBlur = 0;
        });
    }
    
    drawEnemies() {
        this.enemies.forEach(enemy => {
            this.ctx.fillStyle = enemy.color;
            this.ctx.fillRect(
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height,
                enemy.width,
                enemy.height
            );
        });
    }
    
    drawParticles() {
        this.particles.forEach(particle => {
            const alpha = particle.life / 30;
            this.ctx.fillStyle = particle.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
            this.ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
        });
    }
    
    updateUI() {
        // Update score
        const scoreElement = document.getElementById('score-display');
        if (scoreElement) {
            scoreElement.textContent = this.score.toLocaleString();
        }
        
        // Update distance
        const distanceElement = document.getElementById('distance-display');
        if (distanceElement) {
            distanceElement.textContent = Math.floor(this.distance) + 'm';
        }
        
        // Update health
        const healthElement = document.getElementById('health-progress');
        if (healthElement) {
            healthElement.style.width = Math.max(0, this.health) + '%';
        }
        
        // Update power-ups
        this.updatePowerUpDisplay();
    }
    
    updatePowerUpDisplay() {
        const container = document.getElementById('powerup-display');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.powerUps.forEach((powerUp, type) => {
            const timeLeft = Math.ceil((powerUp.endTime - Date.now()) / 1000);
            
            const element = document.createElement('div');
            element.className = 'powerup-item';
            element.innerHTML = `
                <span>${powerUp.icon}</span>
                <span>${timeLeft}s</span>
            `;
            
            container.appendChild(element);
        });
    }
    
    pauseGame() {
        if (this.state === 'playing') {
            this.state = 'paused';
            this.showScreen('pause-screen');
            
            if (this.gameLoop) {
                cancelAnimationFrame(this.gameLoop);
            }
        }
    }
    
    resumeGame() {
        if (this.state === 'paused') {
            this.state = 'playing';
            this.showScreen('game-screen');
            this.startGameLoop();
        }
    }
    
    endGame() {
        this.state = 'gameover';
        
        if (this.gameLoop) {
            cancelAnimationFrame(this.gameLoop);
        }
        
        // Calculate final stats
        const finalTime = Math.floor((Date.now() - this.startTime) / 1000);
        
        // Update UI
        document.getElementById('final-score').textContent = this.score.toLocaleString();
        document.getElementById('final-distance').textContent = Math.floor(this.distance) + 'm';
        document.getElementById('final-time').textContent = finalTime + 's';
        document.getElementById('gameover-quote').textContent = this.getRandomQuote('gameOver');
        
        // Save high score
        this.saveHighScore();
        
        // Show game over screen
        this.showScreen('gameover-screen');
        
        this.playSound('gameover');
    }
    
    saveHighScore() {
        const newScore = {
            score: this.score,
            distance: Math.floor(this.distance),
            time: Math.floor((Date.now() - this.startTime) / 1000),
            date: new Date().toLocaleDateString('cs-CZ')
        };
        
        this.highScores.push(newScore);
        this.highScores.sort((a, b) => b.score - a.score);
        this.highScores = this.highScores.slice(0, 10); // Keep top 10
        
        this.saveData();
    }
    
    checkAchievements() {
        // Distance achievements
        if (this.distance >= 1000 && !this.achievements.find(a => a.id === 'survivor').unlocked) {
            this.unlockAchievement('survivor');
        }
        
        if (this.distance >= 500 && this.health === 100 && !this.achievements.find(a => a.id === 'untouchable').unlocked) {
            this.unlockAchievement('untouchable');
        }
        
        // Score achievement
        if (this.score >= 10000 && !this.achievements.find(a => a.id === 'high_score').unlocked) {
            this.unlockAchievement('high_score');
        }
    }
    
    unlockAchievement(id) {
        const achievement = this.achievements.find(a => a.id === id);
        if (achievement && !achievement.unlocked) {
            achievement.unlocked = true;
            this.showMessage(`🎖️ ${achievement.title} odemčeno!`);
            this.playSound('achievement');
            this.vibrate(300);
            this.saveData();
        }
    }
    
    updateAchievementProgress(id, amount) {
        const achievement = this.achievements.find(a => a.id === id);
        if (achievement && !achievement.unlocked && achievement.hasOwnProperty('progress')) {
            achievement.progress = Math.min(achievement.target, achievement.progress + amount);
            
            if (achievement.progress >= achievement.target) {
                this.unlockAchievement(id);
            }
            
            this.saveData();
        }
    }
    
    showMessage(text, duration = 2000) {
        const messageElement = document.getElementById('game-message');
        const textElement = document.getElementById('message-text');
        
        if (messageElement && textElement) {
            textElement.textContent = text;
            messageElement.classList.add('show');
            
            setTimeout(() => {
                messageElement.classList.remove('show');
            }, duration);
        }
    }
    
    getRandomQuote(category) {
        const quotes = GAME_CONTENT.quotes[category];
        return quotes[Math.floor(Math.random() * quotes.length)];
    }
    
    showScreen(screenId) {
        console.log(`Showing screen: ${screenId}`);
        
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            
            // Update content for specific screens
            if (screenId === 'scores-screen') {
                this.updateScoresDisplay();
            } else if (screenId === 'achievements-screen') {
                this.updateAchievementsDisplay();
            }
        }
    }
    
    updateScoresDisplay() {
        const container = document.getElementById('scores-list');
        if (!container) return;
        
        if (this.highScores.length === 0) {
            container.innerHTML = '<div class="no-scores">Zatím žádné skóre</div>';
            return;
        }
        
        container.innerHTML = this.highScores.map((score, index) => `
            <div class="score-item">
                <div class="score-rank">#${index + 1}</div>
                <div class="score-details">
                    <div class="score-value">${score.score.toLocaleString()}</div>
                    <div class="score-date">${score.date} • ${score.distance}m • ${score.time}s</div>
                </div>
            </div>
        `).join('');
    }
    
    updateAchievementsDisplay() {
        const container = document.getElementById('achievements-list');
        if (!container) return;
        
        container.innerHTML = this.achievements.map(achievement => {
            let progressText = '';
            if (achievement.hasOwnProperty('progress') && !achievement.unlocked) {
                progressText = `<div class="achievement-progress">${achievement.progress}/${achievement.target}</div>`;
            }
            
            return `
                <div class="achievement-item ${achievement.unlocked ? 'unlocked' : ''}">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-details">
                        <div class="achievement-title">${achievement.title}</div>
                        <div class="achievement-description">${achievement.description}</div>
                        ${progressText}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    resetData() {
        if (confirm('Opravdu chceš resetovat všechna data? Tato akce se nedá vrátit.')) {
            localStorage.removeItem('pikoGame');
            this.highScores = [];
            this.achievements.forEach(achievement => {
                achievement.unlocked = false;
                if (achievement.hasOwnProperty('progress')) {
                    achievement.progress = 0;
                }
            });
            this.showMessage('Data resetována!');
        }
    }
    
    loadData() {
        try {
            const saved = localStorage.getItem('pikoGame');
            if (saved) {
                const data = JSON.parse(saved);
                this.highScores = data.highScores || [];
                this.settings = { ...this.settings, ...data.settings };
                
                if (data.achievements) {
                    data.achievements.forEach(savedAch => {
                        const achievement = this.achievements.find(a => a.id === savedAch.id);
                        if (achievement) {
                            achievement.unlocked = savedAch.unlocked;
                            if (savedAch.hasOwnProperty('progress')) {
                                achievement.progress = savedAch.progress;
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error loading ', error);
        }
    }
    
    saveData() {
        try {
            const data = {
                highScores: this.highScores,
                achievements: this.achievements,
                settings: this.settings
            };
            localStorage.setItem('pikoGame', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving ', error);
        }
    }
    
    setupAudio() {
        // Simple audio system using Web Audio API
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sounds = {};
        } catch (error) {
            console.warn('Audio not supported:', error);
        }
    }
    
    playSound(type) {
        if (!this.settings.sound || !this.audioContext) return;
        
        const frequencies = {
            click: 800,
            collect: 1200,
            damage: 300,
            jump: 600,
            move: 400,
            start: 1000,
            gameover: 200,
            achievement: 1500
        };
        
        const frequency = frequencies[type] || 440;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);
        } catch (error) {
            console.warn('Error playing sound:', error);
        }
    }
    
    vibrate(duration) {
        if (this.settings.vibration && navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    game = new Game();
});

// Handle PWA installation
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button/hint if desired
    console.log('PWA install prompt available');
});

window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    deferredPrompt = null;
});

// Handle visibility changes (tab switching)
document.addEventListener('visibilitychange', () => {
    if (game && game.state === 'playing' && document.hidden) {
        game.pauseGame();
    }
});

// Prevent context menu on long press
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);
