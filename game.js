// キャンバスとコンテキストの取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// デバイスタイプの判定
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// キャンバスのサイズ設定
function setCanvasSize() {
  if (isMobile) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  } else {
    canvas.width = 800;
    canvas.height = 600;
  }
}

// プレイヤーと敵のサイズ設定
const playerSize = isMobile ? 40 : 50;
const enemySize = isMobile ? 40 : 50;

// 自機の設定
const playerImage = new Image();
playerImage.src = 'image/hura_1.png';
const enemyImage = new Image();
enemyImage.src = 'image/teki.png';

const player = {
  x: 50,
  y: canvas.height / 2 - playerSize / 2,
  width: playerSize,
  height: playerSize,
  moveUp: false,
  moveDown: false,
  radius: playerSize / 2 // 円形当たり判定用の半径を追加
};

// グローバル変数
let playerSpeed = 5;
let bulletInterval = 500;
let lastBulletTime = 0;
let spawnEnemyInterval;
let animationId;

// 敵の管理
const enemies = [];
const playerBullets = [];
const enemyBullets = [];
let score = 0;
let gameOver = false;

// BGMの設定
const bgm = document.getElementById('bgm');
bgm.volume = 0.5;
let bgmStarted = false;

// 背景の空
function drawSkyBackground() {
  ctx.fillStyle = 'lightblue';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

class Enemy {
  constructor(type) {
    this.x = canvas.width;
    this.y = Math.random() * (canvas.height - enemySize);
    this.width = enemySize;
    this.height = enemySize;
    this.health = 6;
    this.type = type;
    this.angle = 0;
    this.radius = enemySize / 2; // 円形当たり判定用の半径
    this.shootCooldown = 0;
    
    // pause-moveタイプ用の変数
    this.speed = 3; // 初期速度
    this.accelerationTimer = 0;
    this.accelerated = false;
  }

  update() {
    switch (this.type) {
      case 'straight':
        // 直線的に左に移動
        this.x -= 3;
        break;

      case 'circle':
        // 円を描くように移動
        this.x -= 3;
        this.y += Math.sin(this.angle) * 2;
        this.angle += 0.05;
        break;

      case 'zigzag':
        // ジグザグに移動
        this.x -= 3;
        this.y += Math.sin(this.angle) * 5;
        this.angle += 0.1;
        break;

      case 'shooter':
        // 直線的に移動しながら弾を発射
        this.x -= 3;
        if (this.shootCooldown <= 0) {
          this.shoot();
          this.shootCooldown = 100; // 発射クールダウン
        } else {
          this.shootCooldown--;
        }
        break;

      case 'pause-move':
        // 直進し、1.5秒後に速度が2倍になる
        if (!this.accelerated) {
          this.accelerationTimer++;
          if (this.accelerationTimer > 90) { // 1.5秒後（60FPSと仮定）
            this.speed *= 2; // 速度を2倍に
            this.accelerated = true;
          }
        }
        this.x -= this.speed;
        break;
    }

    // 画面外に出たら削除
    if (this.x + this.width < 0) {
      enemies.splice(enemies.indexOf(this), 1);
    }
  }

  shoot() {
    // 敵が弾を発射する関数
    enemyBullets.push(new Bullet(this.x, this.y + this.height / 2, -7, 'red'));
  }

  draw() {
    // 敵を描画する関数
    ctx.drawImage(enemyImage, this.x, this.y, this.width, this.height);
  }
}
// 弾のクラス
class Bullet {
  constructor(x, y, speed, color = 'yellow') {
    this.x = x;
    this.y = y;
    this.width = 10;
    this.height = 5;
    this.speed = speed;
    this.color = color;
  }

  update() {
    this.x += this.speed;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

// 敵をランダム生成
function spawnEnemy() {
  const types = ['circle', 'straight', 'zigzag', 'shooter', 'pause-move',];
  const type = types[Math.floor(Math.random() * types.length)];
  enemies.push(new Enemy(type));
}

// 自機を描画
function drawPlayer() {
  ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
}

// 円形の衝突判定
function checkCircleCollision(circle1, circle2) {
  const dx = circle1.x + circle1.radius - (circle2.x + circle2.radius);
  const dy = circle1.y + circle1.radius - (circle2.y + circle2.radius);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle1.radius + circle2.radius;
}

// 矩形の衝突判定（弾用）
function checkRectCollision(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

// 3点バーストで弾を発射する
function shootBullets() {
  playerBullets.push(new Bullet(player.x + player.width, player.y + player.height / 2 - 10, 7));
  playerBullets.push(new Bullet(player.x + player.width, player.y + player.height / 2, 7));
  playerBullets.push(new Bullet(player.x + player.width, player.y + player.height / 2 + 10, 7));
}

// メインゲームループ
function gameLoop(currentTime) {
  if (gameOver) {
    cancelAnimationFrame(animationId);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSkyBackground();
  drawPlayer();

  // 弾の発射
  if (currentTime - lastBulletTime > bulletInterval) {
    shootBullets();
    lastBulletTime = currentTime;
  }

  playerBullets.forEach((bullet, index) => {
    bullet.update();
    bullet.draw();
    if (bullet.x > canvas.width) {
      playerBullets.splice(index, 1);
    }
  });

  enemyBullets.forEach((bullet, index) => {
    bullet.update();
    bullet.draw();
    if (bullet.x + bullet.width < 0) {
      enemyBullets.splice(index, 1);
    }
  });

  enemies.forEach((enemy) => {
    enemy.update();
    enemy.draw();

    playerBullets.forEach((bullet, bulletIndex) => {
      if (checkRectCollision(bullet, enemy)) {
        enemy.health -= 1;
        playerBullets.splice(bulletIndex, 1);
        if (enemy.health <= 0) {
          enemies.splice(enemies.indexOf(enemy), 1);
          score += 10;
        }
      }
    });

    if (checkCircleCollision(player, enemy)) {
      gameOver = true;
      document.getElementById('final-score').textContent = score;
      document.getElementById('game-over').classList.remove('hidden');
      bgm.pause();
    }
  });

  enemyBullets.forEach((bullet) => {
    if (checkRectCollision(bullet, player)) {
      gameOver = true;
      document.getElementById('final-score').textContent = score;
      document.getElementById('game-over').classList.remove('hidden');
      bgm.pause();
    }
  });

  ctx.fillStyle = '#00ffff';
  ctx.font = '20px Arial';
  ctx.fillText(`Score: ${score}`, 10, 30);

  requestAnimationFrame(gameLoop);
}

// BGMを開始する関数
function startBGM() {
  if (!bgmStarted) {
    bgm.play();
    bgmStarted = true;
  }
}

// 自機の移動（滑らかに）
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') player.moveUp = true;
  if (e.key === 'ArrowDown') player.moveDown = true;
  startBGM();
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp') player.moveUp = false;
  if (e.key === 'ArrowDown') player.moveDown = false;
});

// タッチ操作用の変数
let touchY = null;

// タッチイベントのリスナーを追加
canvas.addEventListener('touchstart', handleTouchStart, false);
canvas.addEventListener('touchmove', handleTouchMove, false);
canvas.addEventListener('touchend', handleTouchEnd, false);

// タッチ開始時の処理
function handleTouchStart(event) {
  event.preventDefault();
  touchY = event.touches[0].clientY;
  startBGM();
}

// タッチ移動時の処理
function handleTouchMove(event) {
  event.preventDefault();
  if (touchY !== null) {
    touchY = event.touches[0].clientY;
  }
}

// タッチ終了時の処理
function handleTouchEnd(event) {
  event.preventDefault();
  touchY = null;
}

function updatePlayerPosition() {
  if (player.moveUp && player.y > 0) player.y -= playerSpeed;
  if (player.moveDown && player.y < canvas.height - player.height) player.y += playerSpeed;

  // タッチ操作による移動
  if (touchY !== null) {
    const targetY = touchY - player.height / 2;
    const diff = targetY - player.y;
    player.y += diff * 0.1; // 滑らかに移動するための係数
    // 画面外に出ないように制限
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
  }

  animationId = requestAnimationFrame(updatePlayerPosition);
}

// ゲームリスタート
document.getElementById('restart-button').addEventListener('click', () => {
  document.getElementById('game-over').classList.add('hidden');
  startGame();
});

// ゲーム開始の処理を関数に移動
function startGame() {
  setCanvasSize();
  gameOver = false;
  score = 0;
  enemies.length = 0;
  playerBullets.length = 0;
  enemyBullets.length = 0;
  // プレイヤーの位置と速度を初期化
  player.x = 50;
  player.y = canvas.height / 2 - player.height / 2;
  playerSpeed = 5;
  // 弾の発射間隔を初期化
  bulletInterval = 300; // 弾の間隔
  lastBulletTime = 0;
  // タッチY座標をリセット
  touchY = null;
  // 既存のアニメーションをキャンセル
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  // 新しくアニメーションを開始
  animationId = requestAnimationFrame(updatePlayerPosition);
  clearInterval(spawnEnemyInterval);
  spawnEnemyInterval = setInterval(spawnEnemy, 400); //敵の間隔
  bgm.currentTime = 0;
  bgmStarted = false;
  requestAnimationFrame(gameLoop);
}

// ウィンドウリサイズ時にキャンバスサイズを再設定
window.addEventListener('resize', () => {
  setCanvasSize();
  if (!gameOver) {
    player.y = canvas.height / 2 - player.height / 2;
  }
});

// ゲーム開始
window.onload = () => {
  setCanvasSize();
  startGame();
};
