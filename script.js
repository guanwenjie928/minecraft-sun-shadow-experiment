/**
 * Minecraft 太阳光与影子科学实验
 * 核心逻辑：太阳高度角计算、影子渲染、时间轴交互
 */

// ===== 配置与常量 =====
const CONFIG = {
    canvasWidth: 960,
    canvasHeight: 540,
    groundY: 400,
    houseX: 420,
    houseWidth: 120,
    houseHeight: 100,
    poleX: 580,
    poleHeight: 80,
    poleWidth: 8,
    latitude: 40, // 北纬40度（北京附近）
    seasons: {
        winter: { name: '冬至', declination: -23.5, noonAngle: 26.5, color: '#88CCFF' },
        equinox: { name: '春分/秋分', declination: 0, noonAngle: 50, color: '#87CEEB' },
        summer: { name: '夏至', declination: 23.5, noonAngle: 73.5, color: '#66BBFF' }
    }
};

// ===== 状态管理 =====
let state = {
    hour: 12,        // 当前时间 (0-24)
    season: 'equinox', // 当前季节
    isPlaying: false,
    playSpeed: 1,    // 播放速度倍率
    animFrame: null,
    lastTimestamp: 0,
    images: {}       // 预加载的图片缓存
};

// ===== 知识点数据 =====
const KNOWLEDGE_DB = {
    0: { phase: '午夜', text: '太阳在地平线以下，月光照亮地面。影子由月光产生，但由于月光很弱，通常难以观察。' },
    1: { phase: '凌晨', text: '太阳仍在地平线以下，天空开始微微发亮（曙光）。此时没有太阳光产生的影子。' },
    2: { phase: '凌晨', text: '天边开始出现鱼肚白，太阳即将升起。此时大气开始散射阳光，但地面还没有直接光照。' },
    3: { phase: '凌晨', text: '黎明前的黑暗即将过去。古代人们用圭表观测日影来确定时间，此时还没有可用的日影。' },
    4: { phase: '拂晓', text: '天快亮了！太阳即将从东方升起。古人说的"鸡鸣而起"大约就是这个时间。' },
    5: { phase: '拂晓', text: '太阳即将升起，天空由深蓝转为橙红。这时如果你朝东方看，会看到美丽的朝霞。' },
    6: { phase: '日出', text: '🌅 太阳从东方升起！<strong>影子朝向正西</strong>，而且非常长。因为太阳刚刚升起，高度角很小，光线几乎是平着照射过来的。' },
    7: { phase: '早晨', text: '太阳在东偏南方向，高度角逐渐增大。<strong>影子朝向西北</strong>，长度开始缩短。适合晨练的时间！' },
    8: { phase: '上午', text: '太阳继续升高，<strong>影子继续缩短</strong>。此时阳光中的紫外线还不算太强，是户外活动的好时机。' },
    9: { phase: '上午', text: '太阳高度角已经相当可观了，影子明显变短。如果你用日晷计时，此时晷针的影子会落在晷面的上午刻度上。' },
    10: { phase: '上午', text: '临近正午，太阳接近正南方天空的最高点。<strong>影子快速缩短</strong>中，方向偏向西北。' },
    11: { phase: '上午', text: '马上就要正午了！太阳高度角接近一天中的最大值，影子也变得很短。古人把这段时间叫做"隅中"。' },
    12: { phase: '正午', text: '☀️ <strong>正午时分！</strong>太阳位于正南方最高点，<strong>太阳高度角最大，影子最短</strong>，朝向正北。此时日晷的影长最短，古人称为"日中"。' },
    13: { phase: '午后', text: '午后时分，太阳开始从最高点向西偏移。<strong>影子逐渐变长</strong>，方向从正北转向东北。' },
    14: { phase: '下午', text: '下午的太阳在西偏南方向，影子朝向东北且继续变长。如果你在北半球，下午的阳光依然很充足。' },
    15: { phase: '下午', text: '下午三点左右，太阳高度角明显降低，影子长度是正午的约1.5倍。这个时间的阳光呈现温暖的金黄色。' },
    16: { phase: '下午', text: '临近傍晚，太阳越来越接近西方地平线，<strong>影子快速变长</strong>。方向偏向东北。' },
    17: { phase: '傍晚', text: '太阳快落山了！高度角很低，<strong>影子变得很长</strong>，朝向东北偏东。此时的阳光被称为"金色时刻"，非常适合摄影。' },
    18: { phase: '日落', text: '🌇 <strong>日落西山！</strong>太阳从西方落下，<strong>影子朝向正东</strong>，非常长。晚霞映红了天空，古人把此时称为"日入"。' },
    19: { phase: '黄昏', text: '太阳刚落山，天空还有余晖（暮光）。此时没有太阳直射光，但天空的散射光还能维持一段时间能见度。' },
    20: { phase: '晚上', text: '夜幕降临，星星开始出现。古人用"月相"和星辰位置来判断时间，因为此时没有日影可参考。' },
    21: { phase: '晚上', text: '夜晚深了，月亮高挂天空。月光也会产生影子，但比阳光产生的影子淡得多。' },
    22: { phase: '深夜', text: '夜深人静，月亮可能已经偏向西方。如果天气晴朗，月影清晰可见，但比日影虚幻得多。' },
    23: { phase: '深夜', text: '午夜前的宁静时刻。在古代，守夜人会根据星辰位置报时。新的一天即将到来，太阳将在几个小时后再次升起。' },
    24: { phase: '午夜', text: '太阳在地平线正下方（子夜），影子完全消失。一天的光影之旅完成，准备迎接新的循环！' }
};

// ===== 图片预加载 =====
function preloadImages() {
    const imageSources = {
        sun: 'assets/sprites/sun.jpg',
        moon: 'assets/sprites/moon.jpg',
        cloud1: 'assets/sprites/cloud1.jpg',
        cloud2: 'assets/sprites/cloud2.jpg',
        skyDay: 'assets/textures/sky-day.jpg',
        skyNight: 'assets/textures/sky-night.jpg',
        skySunset: 'assets/textures/sky-sunset.jpg',
        grassTop: 'assets/textures/grass-top.jpg',
        grassSide: 'assets/textures/grass-side.jpg',
        dirt: 'assets/textures/dirt.jpg',
        sand: 'assets/textures/sand.jpg',
        brick: 'assets/textures/brick.jpg',
        cobblestone: 'assets/textures/cobblestone.jpg',
        oakPlanks: 'assets/textures/oak-planks.jpg',
        glass: 'assets/textures/glass.jpg',
        pole: 'assets/textures/pole.jpg'
    };

    let loaded = 0;
    const total = Object.keys(imageSources).length;

    return new Promise((resolve) => {
        for (const [key, src] of Object.entries(imageSources)) {
            const img = new Image();
            img.onload = () => {
                state.images[key] = img;
                loaded++;
                if (loaded >= total) resolve();
            };
            img.onerror = () => {
                loaded++;
                if (loaded >= total) resolve();
            };
            img.src = src;
        }
        // 超时保护
        setTimeout(() => resolve(), 5000);
    });
}

// ===== 数学计算 =====

/**
 * 计算太阳高度角（度）
 * @param {number} hour - 当前小时 (0-24)
 * @param {number} noonAngle - 正午太阳高度角
 */
function calcSunAltitude(hour, noonAngle) {
    // 简化模型：太阳6点日出，18点日落
    if (hour < 6 || hour > 18) return -1; // 太阳在地平线以下
    const t = (hour - 12) * 15; // 距离正午的角度（度）
    const rad = t * Math.PI / 180;
    const altitude = noonAngle * Math.cos(rad);
    return Math.max(0, altitude);
}

/**
 * 计算太阳方位角（度）
 * 正南为0，东为-90，西为90
 */
function calcSunAzimuth(hour) {
    if (hour < 6 || hour > 18) return null;
    return (hour - 12) * 15;
}

/**
 * 计算影子长度（像素）
 */
function calcShadowLength(altitude, poleHeight) {
    if (altitude <= 0) return null;
    const rad = altitude * Math.PI / 180;
    return poleHeight / Math.tan(rad);
}

/**
 * 计算影子方向（度）
 * 正北为0，西为90，东为-90
 */
function calcShadowDirection(azimuth) {
    if (azimuth === null) return null;
    return -azimuth;
}

/**
 * 方向文字描述
 */
function getDirectionText(direction) {
    if (direction === null) return '无';
    const d = direction;
    if (d >= -10 && d <= 10) return '正北';
    if (d > 10 && d < 35) return '北偏西';
    if (d >= 35 && d <= 55) return '西北';
    if (d > 55 && d < 80) return '西偏北';
    if (d >= 80 || d <= 100) return '正西';
    if (d < -10 && d > -35) return '北偏东';
    if (d <= -35 && d >= -55) return '东北';
    if (d < -55 && d > -80) return '东偏北';
    if (d <= -80 || d >= -100) return '正东';
    return '北';
}

/**
 * 获取天空颜色
 */
function getSkyColor(hour) {
    if (hour >= 7 && hour < 17) {
        return { top: '#4a90d9', bottom: '#87CEEB', phase: 'day' };
    } else if ((hour >= 5 && hour < 7) || (hour >= 17 && hour < 19)) {
        return { top: '#6b3a5c', bottom: '#FF8C42', phase: 'sunset' };
    } else {
        return { top: '#0a0a1a', bottom: '#1a1a2e', phase: 'night' };
    }
}

// ===== Canvas 渲染 =====

const canvas = document.getElementById('sceneCanvas');
const ctx = canvas.getContext('2d');

function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function drawBlockBorder(x, y, w, h, lightColor, darkColor) {
    // 上边和左边亮色
    ctx.fillStyle = lightColor;
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y, 3, h);
    // 下边和右边暗色
    ctx.fillStyle = darkColor;
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillRect(x + w - 3, y, 3, h);
}

function drawSky(hour) {
    const sky = getSkyColor(hour);
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.groundY);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.groundY);

    // 绘制星星（夜晚）
    if (sky.phase === 'night' || (sky.phase === 'sunset' && (hour < 6 || hour > 18))) {
        ctx.fillStyle = '#ffffff';
        const starSeed = Math.floor(hour * 100);
        for (let i = 0; i < 60; i++) {
            const sx = ((starSeed + i * 137) % 1000) / 1000 * CONFIG.canvasWidth;
            const sy = ((starSeed + i * 293) % 1000) / 1000 * (CONFIG.groundY * 0.7);
            const size = ((starSeed + i * 53) % 3) + 1;
            ctx.globalAlpha = 0.3 + ((starSeed + i) % 100) / 200;
            ctx.fillRect(sx, sy, size, size);
        }
        ctx.globalAlpha = 1;
    }

    // 云朵
    if (sky.phase === 'day' || sky.phase === 'sunset') {
        drawClouds(hour);
    }
}

function drawClouds(hour) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const cloudOffset = (hour * 30) % CONFIG.canvasWidth;
    const clouds = [
        { x: 100, y: 60, w: 80, h: 24 },
        { x: 350, y: 90, w: 100, h: 28 },
        { x: 650, y: 50, w: 90, h: 26 },
        { x: 850, y: 110, w: 70, h: 22 }
    ];
    clouds.forEach(c => {
        const cx = ((c.x + cloudOffset) % (CONFIG.canvasWidth + 200)) - 100;
        // 像素风云朵
        ctx.fillRect(cx, c.y, c.w, c.h);
        ctx.fillRect(cx + 8, c.y - 8, c.w - 16, 8);
        ctx.fillRect(cx + 16, c.y - 14, c.w - 32, 6);
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.fillRect(cx + 4, c.y + c.h - 4, c.w - 8, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
    });
}

function drawGround() {
    const gy = CONFIG.groundY;
    const gh = CONFIG.canvasHeight - gy;

    // 草地表层
    if (state.images.grassTop) {
        const pattern = ctx.createPattern(state.images.grassTop, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, gy, CONFIG.canvasWidth, 20);
    } else {
        drawPixelRect(0, gy, CONFIG.canvasWidth, 20, '#567D46');
    }

    // 泥土层
    if (state.images.dirt) {
        const pattern = ctx.createPattern(state.images.dirt, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, gy + 20, CONFIG.canvasWidth, gh - 20);
    } else {
        drawPixelRect(0, gy + 20, CONFIG.canvasWidth, gh - 20, '#8B6914');
    }

    // 草地边缘高光
    ctx.fillStyle = 'rgba(100,180,80,0.3)';
    ctx.fillRect(0, gy, CONFIG.canvasWidth, 3);
}

function drawHouse() {
    const x = CONFIG.houseX;
    const y = CONFIG.groundY - CONFIG.houseHeight;
    const w = CONFIG.houseWidth;
    const h = CONFIG.houseHeight;

    // 房子主体（砖块）
    if (state.images.brick) {
        const pattern = ctx.createPattern(state.images.brick, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(x, y, w, h);
    } else {
        drawPixelRect(x, y, w, h, '#a05040');
    }
    drawBlockBorder(x, y, w, h, '#c07060', '#603020');

    // 屋顶（三角形，深色木板）
    ctx.fillStyle = state.images.oakPlanks ? '#5a4a30' : '#5a4a30';
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + w / 2, y - 40);
    ctx.lineTo(x + w + 10, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 门
    const doorW = 28;
    const doorH = 50;
    const doorX = x + (w - doorW) / 2;
    const doorY = CONFIG.groundY - doorH;
    if (state.images.oakPlanks) {
        const pattern = ctx.createPattern(state.images.oakPlanks, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(doorX, doorY, doorW, doorH);
    } else {
        drawPixelRect(doorX, doorY, doorW, doorH, '#A07850');
    }
    drawBlockBorder(doorX, doorY, doorW, doorH, '#c09870', '#705030');
    // 门把手
    ctx.fillStyle = '#F4D142';
    ctx.fillRect(doorX + doorW - 8, doorY + doorH / 2, 4, 4);

    // 窗户
    const winSize = 24;
    const winY = y + 20;
    // 左窗
    drawWindow(x + 12, winY, winSize);
    // 右窗
    drawWindow(x + w - 12 - winSize, winY, winSize);
}

function drawWindow(wx, wy, size) {
    // 窗框
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(wx - 3, wy - 3, size + 6, size + 6);
    // 玻璃
    if (state.images.glass) {
        const pattern = ctx.createPattern(state.images.glass, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(wx, wy, size, size);
    } else {
        ctx.fillStyle = '#88CCFF';
        ctx.fillRect(wx, wy, size, size);
    }
    // 窗格
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(wx + size / 2 - 1, wy, 2, size);
    ctx.fillRect(wx, wy + size / 2 - 1, size, 2);
    // 反光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(wx + 2, wy + 2, size / 2 - 2, size / 2 - 2);
}

function drawPole() {
    const px = CONFIG.poleX;
    const py = CONFIG.groundY - CONFIG.poleHeight;
    const pw = CONFIG.poleWidth;
    const ph = CONFIG.poleHeight;

    // 标杆主体
    if (state.images.pole) {
        const pattern = ctx.createPattern(state.images.pole, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(px, py, pw, ph);
    } else {
        drawPixelRect(px, py, pw, ph, '#e8e8e8');
        // 条纹
        for (let i = 0; i < ph; i += 10) {
            ctx.fillStyle = i % 20 === 0 ? '#cc3333' : '#e8e8e8';
            ctx.fillRect(px, py + i, pw, 10);
        }
    }
    drawBlockBorder(px, py, pw, ph, '#ffffff', '#999999');

    // 标杆顶部
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(px - 2, py - 4, pw + 4, 4);
}

function drawShadow(hour) {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(hour, seasonData.noonAngle);

    if (altitude <= 0) return;

    const shadowLen = calcShadowLength(altitude, CONFIG.poleHeight);
    const azimuth = calcSunAzimuth(hour);
    const direction = calcShadowDirection(azimuth);
    const dirRad = direction * Math.PI / 180;

    const px = CONFIG.poleX + CONFIG.poleWidth / 2;
    const py = CONFIG.groundY;

    // 影子的两个端点（假设影子宽度与标杆相同）
    const shadowW = CONFIG.poleWidth * (1 + shadowLen / 200);
    const endX = px + Math.sin(dirRad) * shadowLen;
    const endY = py + Math.cos(dirRad) * shadowLen * 0.1; // 略微的透视效果

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000000';

    // 绘制梯形影子
    ctx.beginPath();
    ctx.moveTo(px - shadowW / 2, py + 2);
    ctx.lineTo(px + shadowW / 2, py + 2);
    ctx.lineTo(endX + shadowW / 4, endY + 2);
    ctx.lineTo(endX - shadowW / 4, endY + 2);
    ctx.closePath();
    ctx.fill();

    // 影子边缘模糊效果（像素风用简单的透明度层次）
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(px - shadowW / 2 - 2, py + 2);
    ctx.lineTo(px + shadowW / 2 + 2, py + 2);
    ctx.lineTo(endX + shadowW / 4 + 4, endY + 2);
    ctx.lineTo(endX - shadowW / 4 - 4, endY + 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 绘制影子长度标尺线
    ctx.save();
    ctx.strokeStyle = 'rgba(244,209,66,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, py + 8);
    ctx.lineTo(endX, endY + 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function drawSun(hour) {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(hour, seasonData.noonAngle);

    if (altitude <= 0) {
        // 画月亮
        drawMoon(hour);
        return;
    }

    const azimuth = calcSunAzimuth(hour);
    const azRad = azimuth * Math.PI / 180;

    // 太阳轨迹：弧形，中心在画布上方
    const centerX = CONFIG.canvasWidth / 2;
    const centerY = CONFIG.groundY + 100;
    const radius = 350;

    const sunX = centerX + Math.sin(azRad) * radius;
    const sunY = centerY - Math.cos(azRad) * radius;

    // 太阳光晕
    const glowSize = 60 + Math.sin(Date.now() / 500) * 5;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, glowSize);
    glow.addColorStop(0, 'rgba(255,220,100,0.8)');
    glow.addColorStop(0.5, 'rgba(255,180,50,0.3)');
    glow.addColorStop(1, 'rgba(255,150,30,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - glowSize, sunY - glowSize, glowSize * 2, glowSize * 2);

    // 太阳本体
    const sunSize = 40;
    if (state.images.sun && state.images.sun.complete) {
        ctx.drawImage(state.images.sun, sunX - sunSize / 2, sunY - sunSize / 2, sunSize, sunSize);
    } else {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(sunX - sunSize / 2, sunY - sunSize / 2, sunSize, sunSize);
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(sunX - sunSize / 2 + 4, sunY - sunSize / 2 + 4, sunSize - 8, sunSize - 8);
    }

    // 光线
    ctx.strokeStyle = 'rgba(255,220,100,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const angle = (Date.now() / 2000 + i * Math.PI / 4);
        const rayLen = 60;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(angle) * 22, sunY + Math.sin(angle) * 22);
        ctx.lineTo(sunX + Math.cos(angle) * rayLen, sunY + Math.sin(angle) * rayLen);
        ctx.stroke();
    }
}

function drawMoon(hour) {
    const centerX = CONFIG.canvasWidth / 2;
    const centerY = CONFIG.groundY + 100;
    const radius = 350;

    // 月亮位置：与太阳相对
    const moonHour = (hour + 12) % 24;
    const moonAz = (moonHour - 12) * 15;
    const moonAzRad = moonAz * Math.PI / 180;

    const moonX = centerX + Math.sin(moonAzRad) * radius;
    const moonY = centerY - Math.cos(moonAzRad) * radius * 0.6;

    if (moonY > CONFIG.groundY - 50) return; // 月亮在地平线以下

    const moonSize = 32;

    // 月亮光晕
    const glow = ctx.createRadialGradient(moonX, moonY, 5, moonX, moonY, 40);
    glow.addColorStop(0, 'rgba(200,200,255,0.4)');
    glow.addColorStop(1, 'rgba(200,200,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(moonX - 40, moonY - 40, 80, 80);

    if (state.images.moon && state.images.moon.complete) {
        ctx.drawImage(state.images.moon, moonX - moonSize / 2, moonY - moonSize / 2, moonSize, moonSize);
    } else {
        ctx.fillStyle = '#DDDDDD';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonSize / 2, 0, Math.PI * 2);
        ctx.fill();
        // 月坑
        ctx.fillStyle = '#BBBBBB';
        ctx.beginPath();
        ctx.arc(moonX - 4, moonY - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(moonX + 5, moonY + 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawRuler() {
    const startX = 80;
    const endX = 880;
    const y = CONFIG.groundY + 50;

    ctx.strokeStyle = 'rgba(244,209,66,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(244,209,66,0.7)';
    ctx.font = 'bold 12px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';

    for (let m = 0; m <= 8; m++) {
        const x = startX + (endX - startX) * m / 8;
        ctx.fillRect(x - 1, y - 5, 2, 10);
        ctx.fillText(m + 'm', x, y + 22);
    }
}

function render() {
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    drawSky(state.hour);
    drawSun(state.hour);
    drawGround();
    drawShadow(state.hour);
    drawHouse();
    drawPole();
    drawRuler();
}

// ===== UI 更新 =====

function updateDataPanel() {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(state.hour, seasonData.noonAngle);
    const azimuth = calcSunAzimuth(state.hour);
    const shadowLen = altitude > 0 ? calcShadowLength(altitude, CONFIG.poleHeight) : null;
    const direction = calcShadowDirection(azimuth);

    // 时间
    const h = Math.floor(state.hour);
    const m = Math.floor((state.hour - h) * 60);
    document.getElementById('timeDisplay').textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    const phaseData = KNOWLEDGE_DB[h] || KNOWLEDGE_DB[0];
    document.getElementById('timePhase').textContent = phaseData.phase;

    // 太阳高度角
    if (altitude > 0) {
        document.getElementById('angleDisplay').textContent = altitude.toFixed(1) + '°';
        if (altitude > 70) document.getElementById('angleDesc').textContent = '太阳接近天顶';
        else if (altitude > 40) document.getElementById('angleDesc').textContent = '太阳高度适中';
        else document.getElementById('angleDesc').textContent = '太阳较低';
    } else {
        document.getElementById('angleDisplay').textContent = '--';
        document.getElementById('angleDesc').textContent = '太阳在地平线以下';
    }

    // 影子长度
    if (shadowLen !== null) {
        const realLen = (shadowLen / 80).toFixed(2); // 转换为米
        document.getElementById('shadowDisplay').textContent = realLen + 'm';
        if (shadowLen < 30) document.getElementById('shadowDesc').textContent = '影子很短';
        else if (shadowLen < 80) document.getElementById('shadowDesc').textContent = '影子中等';
        else document.getElementById('shadowDesc').textContent = '影子很长';
    } else {
        document.getElementById('shadowDisplay').textContent = '--';
        document.getElementById('shadowDesc').textContent = '无阳光照射';
    }

    // 影子方向
    if (direction !== null) {
        document.getElementById('directionDisplay').textContent = getDirectionText(direction);
        document.getElementById('directionDesc').textContent = `与太阳方向相反`;
    } else {
        document.getElementById('directionDisplay').textContent = '--';
        document.getElementById('directionDesc').textContent = '夜间无影';
    }
}

function updateKnowledge() {
    const h = Math.floor(state.hour);
    const data = KNOWLEDGE_DB[h] || KNOWLEDGE_DB[0];
    const seasonName = CONFIG.seasons[state.season].name;
    document.getElementById('knowledgeContent').innerHTML =
        `【${data.phase} | ${seasonName}】${data.text}`;
}

function updateTimelineUI() {
    // 更新进度条
    const pct = (state.hour / 24) * 100;
    document.getElementById('timelineProgress').style.width = pct + '%';
    document.getElementById('timelineCurrent').style.left = pct + '%';

    // 更新小时按钮
    document.querySelectorAll('.hour-btn').forEach(btn => {
        const h = parseInt(btn.dataset.hour);
        btn.classList.toggle('active', Math.floor(state.hour) === h);
    });
}

function updateReportTable() {
    const tbody = document.getElementById('reportBody');
    tbody.innerHTML = '';

    const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    hours.forEach(h => {
        const seasonData = CONFIG.seasons[state.season];
        const alt = calcSunAltitude(h, seasonData.noonAngle);
        const az = calcSunAzimuth(h);
        const len = alt > 0 ? calcShadowLength(alt, CONFIG.poleHeight) : null;
        const dir = calcShadowDirection(az);

        let sunPos = '';
        if (h < 12) sunPos = '东偏南';
        else if (h === 12) sunPos = '正南';
        else sunPos = '西偏南';

        let rule = '';
        if (h === 6 || h === 18) rule = '日出/日落，影子最长';
        else if (h === 12) rule = '正午，影子最短';
        else if (h < 12) rule = '上午，影子逐渐缩短';
        else rule = '下午，影子逐渐变长';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${h}:00</td>
            <td>${sunPos}</td>
            <td>${alt > 0 ? alt.toFixed(1) + '°' : '--'}</td>
            <td>${dir !== null ? getDirectionText(dir) : '--'}</td>
            <td>${len !== null ? (len / 80).toFixed(2) + 'm' : '--'}</td>
            <td>${rule}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ===== 时间轴构建 =====

function buildTimeline() {
    const container = document.getElementById('timelineHours');
    container.innerHTML = '';

    for (let h = 0; h <= 24; h++) {
        const btn = document.createElement('button');
        btn.className = 'hour-btn' + ((h < 6 || h > 18) ? ' night' : '');
        btn.dataset.hour = h;
        btn.textContent = h;
        btn.title = KNOWLEDGE_DB[h]?.phase || '';
        btn.addEventListener('click', () => setHour(h));
        container.appendChild(btn);
    }

    // 轨道标记
    const markers = document.getElementById('timelineMarkers');
    markers.innerHTML = '';
    for (let h = 0; h <= 24; h++) {
        const m = document.createElement('div');
        m.className = 'timeline-marker' + (h % 6 === 0 ? ' major' : '');
        m.style.left = (h / 24 * 100) + '%';
        markers.appendChild(m);
    }
}

// ===== 控制逻辑 =====

function setHour(h) {
    state.hour = Math.max(0, Math.min(24, h));
    render();
    updateDataPanel();
    updateKnowledge();
    updateTimelineUI();
}

function setSeason(season) {
    state.season = season;
    document.querySelectorAll('.season-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.season === season);
    });
    render();
    updateDataPanel();
    updateKnowledge();
    updateReportTable();
}

function togglePlay() {
    state.isPlaying = !state.isPlaying;
    document.getElementById('btnPlay').style.display = state.isPlaying ? 'none' : 'flex';
    document.getElementById('btnPause').style.display = state.isPlaying ? 'flex' : 'none';

    if (state.isPlaying) {
        state.lastTimestamp = performance.now();
        animate();
    } else {
        cancelAnimationFrame(state.animFrame);
    }
}

function animate() {
    if (!state.isPlaying) return;

    const now = performance.now();
    const dt = (now - state.lastTimestamp) / 1000;
    state.lastTimestamp = now;

    // 播放速度：正常1小时/秒，快进3小时/秒
    const speed = state.playSpeed === 2 ? 3 : 1;
    state.hour += dt * speed;

    if (state.hour >= 24) {
        state.hour = 0;
    }

    render();
    updateDataPanel();
    updateTimelineUI();

    state.animFrame = requestAnimationFrame(animate);
}

function resetExperiment() {
    state.isPlaying = false;
    cancelAnimationFrame(state.animFrame);
    document.getElementById('btnPlay').style.display = 'flex';
    document.getElementById('btnPause').style.display = 'none';
    state.playSpeed = 1;
    document.getElementById('btnFast').style.borderColor = '#555';
    setHour(12);
}

function toggleFast() {
    state.playSpeed = state.playSpeed === 2 ? 1 : 2;
    const btn = document.getElementById('btnFast');
    btn.style.borderColor = state.playSpeed === 2 ? '#F4D142' : '#555';
}

function toggleReport() {
    const wrapper = document.getElementById('reportWrapper');
    const isVisible = wrapper.style.display !== 'none';
    wrapper.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        updateReportTable();
    }
}

// ===== 事件绑定 =====

function bindEvents() {
    document.getElementById('btnPlay').addEventListener('click', togglePlay);
    document.getElementById('btnPause').addEventListener('click', togglePlay);
    document.getElementById('btnReset').addEventListener('click', resetExperiment);
    document.getElementById('btnFast').addEventListener('click', toggleFast);
    document.getElementById('btnReport').addEventListener('click', toggleReport);

    document.querySelectorAll('.season-btn').forEach(btn => {
        btn.addEventListener('click', () => setSeason(btn.dataset.season));
    });

    // 时间轴轨道点击跳转
    document.querySelector('.timeline-track').addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = x / rect.width;
        setHour(pct * 24);
    });

    // 键盘控制
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') setHour(state.hour - 0.5);
        if (e.key === 'ArrowRight') setHour(state.hour + 0.5);
        if (e.key === ' ') {
            e.preventDefault();
            togglePlay();
        }
    });
}

// ===== 初始化 =====

async function init() {
    buildTimeline();
    bindEvents();
    await preloadImages();
    setHour(12);
    updateReportTable();

    // 窗口大小调整
    window.addEventListener('resize', () => {
        render();
    });
}

// 启动
init();
