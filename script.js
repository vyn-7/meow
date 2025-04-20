window.onload = () => {
  const loadingScreen = document.getElementById("loading-screen");
  const menuScreen = document.getElementById("menu-screen");
  const canvas = document.getElementById("game-canvas");
  const leftButton = document.getElementById("left-btn");
  const rightButton = document.getElementById("right-btn");
  const spawnButton = document.getElementById("spawn-btn");
  const bgMusic = document.getElementById("bg-music");
  const statusText = document.getElementById("status-text");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const frameSpeed = 100;
  const maxSpeed = 60;
  const accelRate = 0.85;
  const friction = 0.95;
  const dayLength = 1440000;
  const meowSounds = [
    new Audio("./assets/audio/meow1.mp3"),
    new Audio("./assets/audio/meow2.mp3"),
    new Audio("./assets/audio/meow3.mp3"),
    new Audio("./assets/audio/meow4.mp3"),
    new Audio("./assets/audio/meow5.mp3"),
  ];

  const keys = { left: false, right: false };
  const background = new Map();
  let selectedMouse = null;
  let particles = [];
  let ingameMinutes = 0;
  let bondLevel = 0;
  let dayTime = Math.random() * dayLength;
  let currentDarkness = 0;
  let targetDarkness = 0;
  let lastTime = performance.now();
  let cameraX = 0;
  let cameraVelocity = 0;
  let playing = false;

  // Load background images for forest
  for (let i = 0; i <= 11; i++) {
    const image = new Image();
    image.src = `./assets/backgrounds/forest/layer_${i}.png`;
    background.set(i, image);
  }

  const chatbox = new Image();
  chatbox.src = `./assets/chatbox.png`;
  loadingScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  function showMessage(text) {
    const log = document.getElementById("message-log");
    const message = document.createElement("div");
    message.textContent = text;
    message.style.opacity = "0";
    log.appendChild(message);
    message.classList.add("message-entry");
    message.style.opacity = "1";

    setTimeout(() => {
      message.classList.remove("message-entry");
      void message.offsetWidth;
      message.classList.add("fade-out");
      setTimeout(() => {
        message.remove();
      }, 1000);
    }, 2500);

    const currentMessages = log.querySelectorAll("div");
    if (currentMessages.length > 5) {
      currentMessages[0].classList.remove("message-entry");
      void currentMessages[0].offsetWidth;
      currentMessages[0].classList.add("fade-out");
      setTimeout(() => {
        currentMessages[0].remove();
      }, 1000);
    }
  }

  function updateTimeDisplay() {
    const hours = Math.floor(ingameMinutes / 60);
    const minutes = ingameMinutes % 60;
    const displayHour = ((hours + 11) % 12) + 1;
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedMinutes = minutes.toString().padStart(2, "0");
    statusText.textContent = `Time: ${displayHour}:${formattedMinutes} ${ampm}`;
  }

  function updateBondLevel() {
    ctx.font = "11px 'Press Start 2P'";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(
      `Sean & Powi Bond: ${Math.floor(bondLevel)}%`,
      canvas.width / 2,
      30
    );
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.radius = Math.random() * 2 + 1;
      this.alpha = 1;
      this.dy = Math.random() * -1.5 - 0.5;
      this.color = color;
    }

    update() {
      this.y += this.dy;
      this.alpha -= 0.02;
    }

    draw() {
      ctx.beginPath();
      ctx.fillStyle = `${this.color}${this.alpha})`;
      ctx.arc(this.x - cameraX, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class Material {
    constructor(material) {
      this.material = material;
      this.frameWidth = material === "mouse" ? 42 : 0;
      this.frameHeight = material === "mouse" ? 32 : 0;
      this.drawWidth = this.frameWidth + 15;
      this.drawHeight = this.frameHeight + 15;
      this.animation = new Image();
      this.animation.src = `./assets/objects/${material}.png`;
      this.frameTimer = 0;
      this.currentFrame = 0;
      this.x = Math.floor(Math.random() * (2000 + canvas.width)) - 1000;
      this.y = canvas.height - this.drawHeight * 3.6;
      this.velocity = 0;
      this.speed = 2;
      this.facingLeft = false;
      this.behaviorTimer = 0;
      this.behaviorDelay = Math.random() * 2000 + 2000;
      this.isDragging = false;
      this.offsetX = 0;
      this.offsetY = 0;
      this.gravity = 0;
      this.chased = false;
    }

    getFrames() {
      return this.material === "mouse" ? 4 : 0;
    }

    update(deltaTime) {
      this.frameTimer += deltaTime;

      if (!this.isDragging) {
        this.behaviorTimer += deltaTime;
      }

      if (this.frameTimer >= frameSpeed) {
        this.currentFrame = (this.currentFrame + 1) % this.getFrames();
        this.frameTimer = 0;
      }

      if (!this.isDragging && this.behaviorTimer >= this.behaviorDelay) {
        this.velocity = Math.random() < 0.5 ? -this.speed : this.speed;
        this.facingLeft = this.velocity < 0;
        this.behaviorTimer = 0;
        this.behaviorDelay = Math.random() * 2000 + 2000;
      }

      if (!this.isDragging) {
        this.y += this.gravity;

        if (this.y >= canvas.height - this.drawHeight * 3.6) {
          this.y = canvas.height - this.drawHeight * 3.6;
          this.gravity = 0;
          this.x = this.x + this.velocity;
        } else {
          this.gravity += 0.5;
        }
      }
    }

    draw() {
      const drawX = this.x - cameraX + this.frameWidth / 2;
      const drawY = this.y;

      ctx.save();
      ctx.scale(this.facingLeft ? -1 : 1, 1);
      ctx.drawImage(
        this.animation,
        this.currentFrame * this.frameWidth,
        0,
        this.frameWidth,
        this.frameHeight,
        this.facingLeft ? -drawX - this.drawWidth : drawX,
        drawY,
        this.drawWidth,
        this.drawHeight
      );
      ctx.restore();
    }

    isHit(mx, my) {
      return (
        mx >= this.x - cameraX &&
        mx <= this.x - cameraX + this.drawWidth &&
        my >= this.y &&
        my <= this.y + this.drawHeight
      );
    }
  }

  class Cat {
    constructor(name) {
      this.name = name;
      this.idle = new Image();
      this.idle.src = `./assets/cats/${name}/${name}_idle.png`;
      this.run = new Image();
      this.run.src = `./assets/cats/${name}/${name}_run.png`;
      this.frameWidth = 32;
      this.frameHeight = 32;
      this.drawWidth = this.frameWidth + 60;
      this.drawHeight = this.frameHeight + 60;
      this.frameTimer = 0;
      this.currentFrame = 0;
      this.facingLeft = false;
      this.x = Math.floor(Math.random() * (2000 + canvas.width)) - 1000;
      this.y = canvas.height - this.drawHeight * 2.3;
      this.velocity = 0;
      this.speed = 1.5;
      this.behaviorTimer = 0;
      this.behaviorDelay = Math.random() * 2000 + 2000;
      this.isHappy = false;
      this.happyTimer = 0;
      this.chasing = null;
      this.bondMessageCooldown = 0;
    }

    showAffection() {
      if (this.isHappy) return;
      const randomIndex = Math.floor(Math.random() * meowSounds.length);
      const meow = meowSounds[randomIndex].cloneNode();
      meow.playbackRate = Math.random() * 1.5 + 0.75;
      meow.volume = Math.random() * 0.4 + 0.4;
      meow.play();
      showMessage("you interacted with " + this.name);
    }

    getFrames() {
      return this.velocity === 0 ? 7 : 9;
    }

    update(deltaTime) {
      if (this.isHappy) this.happyTimer += deltaTime;
      if (!this.chasing) this.behaviorTimer += deltaTime;
      this.frameTimer += deltaTime;

      if (this.happyTimer >= 2000) {
        this.isHappy = false;
        this.happyTimer = 0;
      }

      if (this.bondMessageCooldown > 0) {
        this.bondMessageCooldown -= deltaTime;
      }

      if (this.name === "sean" || this.name === "powi") {
        const otherCat = cats.find(
          (cat) => cat.name === (this.name === "sean" ? "powi" : "sean")
        );
        const dist = Math.abs(this.x - otherCat.x);

        if (dist < 20 && Math.abs(this.y - otherCat.y) < 50) {
          bondLevel = Math.min(100, bondLevel + deltaTime * 0.01);
          if (this.name === "sean" && this.bondMessageCooldown <= 0) {
            showMessage("sean interacted with powi");
            this.isHappy = true;
            this.happyTimer = 0;
            this.bondMessageCooldown = 5000;
          }
        }
      }

      if (this.frameTimer >= frameSpeed) {
        this.currentFrame = (this.currentFrame + 1) % this.getFrames();
        this.frameTimer = 0;
      }

      if (!this.chasing && this.behaviorTimer >= this.behaviorDelay) {
        const choice = Math.floor(Math.random() * 4);
        if (choice === 3) {
          for (let material of materials) {
            if (material.chased) continue;
            this.chasing = material;
            material.chased = this;
            showMessage(this.name + " is chasing a " + material.material);
            break;
          }
        } else {
          this.velocity =
            choice === 0 ? 0 : choice === 1 ? -this.speed : this.speed;
        }

        this.behaviorTimer = 0;
        this.behaviorDelay = Math.random() * 2000 + 2000;
      } else if (this.chasing) {
        this.velocity = this.x >= this.chasing.x ? -this.speed : this.speed;
        const target = this.chasing;
        const dist = Math.abs(this.x - target.x);

        if (!materials.includes(target)) {
          showMessage(this.name + " gave up chasing the " + target.material);
          this.chasing = null;
          target.chased = null;
        } else if (Math.abs(this.y - target.y) < 50 && dist < 20) {
          showMessage(this.name + " caught the " + target.material + "!");
          materials = materials.filter((m) => m !== target);
          this.chasing = null;
        }
      }

      this.facingLeft = this.velocity < 0;
      this.x = Math.max(
        -1000,
        Math.min(1000 + canvas.width - this.drawWidth, this.x + this.velocity)
      );

      this.y = canvas.height - this.drawHeight * 2.3;

      if (this.velocity !== 0 && this.currentFrame % 9 === 0) {
        particles.push(
          new Particle(
            this.x + (this.facingLeft ? this.drawWidth : this.frameWidth),
            this.y + this.drawHeight,
            "rgba(150, 120, 90,"
          )
        );
      }
    }

    draw() {
      const drawX = this.x - cameraX + this.frameWidth / 2;
      const drawY = this.y;
      ctx.font = "11px 'Press Start 2P'";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";

      ctx.strokeText(this.name, drawX + 40, drawY - 5);
      ctx.fillText(this.name, drawX + 40, drawY - 5);

      if (this.isHappy) {
        ctx.drawImage(chatbox, drawX + 20, drawY - 55, 40, 40);
        ctx.font = "18px 'Press Start 2P'";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.strokeText("❤️", drawX + 40, drawY - 30);
        ctx.fillText("❤️", drawX + 40, drawY - 30);
      }

      const sprite = this.velocity === 0 ? this.idle : this.run;

      ctx.save();
      ctx.scale(this.facingLeft ? -1 : 1, 1);
      ctx.drawImage(
        sprite,
        this.currentFrame * this.frameWidth,
        0,
        this.frameWidth,
        this.frameHeight,
        this.facingLeft ? -drawX - this.drawWidth : drawX,
        drawY,
        this.drawWidth,
        this.drawHeight
      );
      ctx.restore();
    }
  }

  let cats = ["sean", "powi", "uling", "adidas", "mingkay"].map(
    (name) => new Cat(name)
  );
  let materials = [];

  function drawLayer(start, end) {
    for (let i = end; i >= start; i--) {
      const img = background.get(i);
      const scale = 2;
      const width = img.width * scale;
      const height = img.height * scale;
      const y = canvas.height - height;

      const speed = 1 - i / background.size;
      const scrollX = (-cameraX * speed) % width;

      for (let offset of [-1, 0, 1]) {
        ctx.drawImage(img, scrollX + offset * width, y, width, height);
      }
    }
  }

  function updateGame(time) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dayTime = (dayTime + deltaTime) % dayLength;
    ingameMinutes = Math.floor(dayTime / 1000);
    const hour = Math.floor(ingameMinutes / 60);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    cameraVelocity += keys.right ? accelRate : keys.left ? -accelRate : 0;
    cameraVelocity *= friction;
    cameraVelocity = Math.max(-maxSpeed, Math.min(maxSpeed, cameraVelocity));
    cameraX = Math.max(-1000, Math.min(1000, cameraX + cameraVelocity));

    drawLayer(2, 11);

    particles.forEach((particle) => {
      particle.update();
      particle.draw();
    });

    particles = particles.filter((particle) => particle.alpha > 0);

    targetDarkness =
      hour >= 19 || hour < 5
        ? 0.6
        : hour >= 17 && hour < 19
        ? 0.4
        : hour >= 5 && hour < 7
        ? 0.2
        : 0;
    currentDarkness += (targetDarkness - currentDarkness) * 0.005;
    ctx.fillStyle = `rgba(0, 0, 0, ${currentDarkness.toFixed(3)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (hour >= 19 || hour < 5) {
      cats.forEach((cat) => {
        const lightRadius = 100;
        const catCenterX = cat.x + cat.drawWidth / 2 - cameraX;
        const catCenterY = cat.y + cat.drawHeight / 2;
        const gradient = ctx.createRadialGradient(
          catCenterX,
          catCenterY,
          0,
          catCenterX,
          catCenterY,
          lightRadius
        );
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.1)");
        gradient.addColorStop(1, "rgba(255, 255, 200, 0.01)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(catCenterX, catCenterY, lightRadius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    cats.forEach((cat) => {
      cat.update(deltaTime);
      cat.draw();
    });

    materials = materials.filter((material) => {
      material.update(deltaTime);
      material.draw();
      if (
        material.x <= -1000 ||
        material.x >= 1000 + canvas.width - material.drawWidth
      ) {
        showMessage("the " + material.material + " ran away!");
        return false;
      } else return true;
    });

    drawLayer(0, 1);
    updateTimeDisplay();
    updateBondLevel();
    requestAnimationFrame(updateGame);
  }

  function checkCatAffection(x, y) {
    cats.forEach((cat) => {
      if (
        x >= cat.x - cameraX &&
        x <= cat.x - cameraX + cat.drawWidth &&
        y >= cat.y &&
        y <= cat.y + cat.drawHeight
      ) {
        cat.showAffection();
        cat.isHappy = true;
      }
    });
  }

  function getPointerPos(event) {
    return event.touches
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : { x: event.clientX, y: event.clientY };
  }

  function startDrag(event) {
    const pos = getPointerPos(event);
    materials.forEach((material) => {
      if (material.material === "mouse" && material.isHit(pos.x, pos.y)) {
        selectedMouse = material;
        material.isDragging = true;
        material.offsetX =
          pos.x - (material.x - cameraX + material.frameWidth / 2);
        material.offsetY = pos.y - material.y;
        material.gravity = 0;
      }
    });
  }

  canvas.addEventListener("mousedown", startDrag);
  canvas.addEventListener("touchstart", startDrag);

  function drag(event) {
    if (selectedMouse && selectedMouse.isDragging) {
      event.preventDefault();
      const pos = getPointerPos(event);
      selectedMouse.x = Math.max(
        -1000,
        Math.min(
          1000 + canvas.width - selectedMouse.drawWidth,
          pos.x - selectedMouse.offsetX + cameraX - selectedMouse.frameWidth / 2
        )
      );
      selectedMouse.y = Math.min(
        canvas.height - selectedMouse.drawHeight * 3.6,
        pos.y - selectedMouse.offsetY
      );
    }
  }

  canvas.addEventListener("mousemove", drag);
  canvas.addEventListener("touchmove", drag);

  function endDrag() {
    if (selectedMouse) {
      selectedMouse.isDragging = false;
      selectedMouse.gravity = 2;
      selectedMouse = null;
    }
  }

  canvas.addEventListener("mouseup", endDrag);
  canvas.addEventListener("touchend", endDrag);

  // Event listeners
  const handleKeydown = ({ code }) => {
    if (!playing) return;
    if (code === "ArrowRight" || code === "KeyD") keys.right = true;
    if (code === "ArrowLeft" || code === "KeyA") keys.left = true;
  };

  const handleKeyup = ({ code }) => {
    if (!playing) return;
    if (code === "ArrowRight" || code === "KeyD") keys.right = false;
    if (code === "ArrowLeft" || code === "KeyA") keys.left = false;
  };

  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("keyup", handleKeyup);

  leftButton.addEventListener("pointerdown", () => {
    if (playing) keys.left = true;
  });

  rightButton.addEventListener("pointerdown", () => {
    if (playing) keys.right = true;
  });

  window.addEventListener("pointerup", () => {
    if (playing) keys.left = keys.right = false;
  });

  spawnButton.addEventListener("click", (event) => {
    if (materials.length > 5)
      return showMessage("cant spawn more than 5 mouse");
    materials.push(new Material("mouse"));
    showMessage("a mouse has appeared!");
  });

  canvas.addEventListener("click", (event) => {
    if (!playing) return;
    const pos = getPointerPos(event);
    checkCatAffection(pos.x, pos.y);
  });

  canvas.addEventListener("touchstart", (event) => {
    if (!playing) return;
    const pos = getPointerPos(event);
    checkCatAffection(pos.x, pos.y);
  });

  document.addEventListener("click", () => {
    if (!playing) {
      menuScreen.classList.add("fade-out");
      setTimeout(() => {
        menuScreen.classList.add("hidden");
        document.getElementById("game-wrapper").classList.remove("hidden");
        document.getElementById("touch-controls").classList.remove("hidden");
        statusText.classList.remove("hidden");

        bgMusic.volume = 0.5;
        bgMusic.play().catch(console.error);
        playing = true;
      }, 1000);
    }
  });

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  window.addEventListener(
    "wheel",
    (event) => event.ctrlKey && event.preventDefault(),
    {
      passive: false,
    }
  );

  window.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey && ["+", "-", "="].includes(event.key)) ||
      event.key === "Meta"
    ) {
      event.preventDefault();
    }
  });

  requestAnimationFrame(updateGame);
};
