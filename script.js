/**
 * Minecraft 太阳光与影子科学实验 — 2.5D 等角视角引擎
 * 核心特性：
 *   - 等角投影（Isometric）地面网格，精灵图方块堆叠
 *   - 360° 影子方向与长度实时计算
 *   - 太阳→标杆光线指示虚线
 *   - 季节切换、24小时时间轴、知识面板
 */

// ===== 配置与常量 =====
const CONFIG = {
    canvasWidth: 960,
    canvasHeight: 600,

    // 2.5D 等角投影参数
    isoCenterX: 480,
    isoBaseY: 320,       // 地面层(worldY=0)顶面的中心Y
    isoTileW: 72,        // 顶面水平宽度（像素）
    isoTileH: 36,        // 顶面垂直半高（像素），保持2:1比例
    isoBlockDepth: 36,   // 方块侧面高度（像素），与isoTileH相同形成正方体
    isoGridRadius: 3,    // 地面网格半径（3=7x7网格）
    isoPoleHeight: 6,    // 标杆高度（方块数）
    shadowScale: 0.45,   // 影子长度世界坐标缩放因子

    // 天空参数
    skyCenterY: 130,
    skyRadius: 260,

    // 地理参数
    latitude: 40,
    seasons: {
        winter: { name: '冬至', declination: -23.5, noonAngle: 26.5, color: '#88CCFF' },
        equinox: { name: '春分/秋分', declination: 0, noonAngle: 50, color: '#87CEEB' },
        summer: { name: '夏至', declination: 23.5, noonAngle: 73.5, color: '#66BBFF' }
    }
};

// ===== 状态管理 =====
let state = {
    hour: 12,
    season: 'equinox',
    isPlaying: false,
    playSpeed: 1,
    animFrame: null,
    lastTimestamp: 0,
    images: {}
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
            img.onload = () => { state.images[key] = img; loaded++; if (loaded >= total) resolve(); };
            img.onerror = () => { loaded++; if (loaded >= total) resolve(); };
            img.src = src;
        }
        setTimeout(() => resolve(), 5000);
    });
}

// ===== 数学计算 =====

function calcSunAltitude(hour, noonAngle) {
    if (hour < 6 || hour > 18) return -1;
    const t = (hour - 12) * 15;
    const rad = t * Math.PI / 180;
    const altitude = noonAngle * Math.cos(rad);
    return Math.max(0, altitude);
}

function calcSunAzimuth(hour) {
    if (hour < 6 || hour > 18) return null;
    return (hour - 12) * 15;
}

function calcShadowLength(altitude, poleHeight) {
    if (altitude <= 0) return null;
    const rad = altitude * Math.PI / 180;
    return poleHeight / Math.tan(rad);
}

function calcShadowDirection(azimuth) {
    if (azimuth === null) return null;
    return -azimuth;
}

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

function getSkyColor(hour) {
    if (hour >= 7 && hour < 17) return { top: '#4a90d9', bottom: '#87CEEB', phase: 'day' };
    else if ((hour >= 5 && hour < 7) || (hour >= 17 && hour < 19)) return { top: '#6b3a5c', bottom: '#FF8C42', phase: 'sunset' };
    else return { top: '#0a0a1a', bottom: '#1a1a2e', phase: 'night' };
}

// ===== 2.5D 等角投影核心 =====

/**
 * 世界坐标 → 屏幕坐标
 * worldX: 东(+) / 西(-)
 * worldY: 上(+) / 下(-)
 * worldZ: 南(+) / 北(-)
 */
function isoToScreen(worldX, worldY, worldZ) {
    const tw = CONFIG.isoTileW;
    const th = CONFIG.isoTileH;
    return {
        x: CONFIG.isoCenterX + (worldX - worldZ) * tw / 2,
        y: CONFIG.isoBaseY + (worldX + worldZ) * th / 2 - worldY * th
    };
}

// ===== Canvas 渲染 =====

const canvas = document.getElementById('sceneCanvas');
const ctx = canvas.getContext('2d');

function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

// --- 天空 ---
function drawSky(hour) {
    const sky = getSkyColor(hour);
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.isoBaseY - 60);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.isoBaseY - 60);

    if (sky.phase === 'night' || (sky.phase === 'sunset' && (hour < 6 || hour > 18))) {
        ctx.fillStyle = '#ffffff';
        const starSeed = Math.floor(hour * 100);
        for (let i = 0; i < 80; i++) {
            const sx = ((starSeed + i * 137) % 1000) / 1000 * CONFIG.canvasWidth;
            const sy = ((starSeed + i * 293) % 1000) / 1000 * (CONFIG.skyCenterY * 0.8);
            const size = ((starSeed + i * 53) % 3) + 1;
            ctx.globalAlpha = 0.3 + ((starSeed + i) % 100) / 200;
            ctx.fillRect(sx, sy, size, size);
        }
        ctx.globalAlpha = 1;
    }

    if (sky.phase === 'day' || sky.phase === 'sunset') {
        drawClouds(hour);
    }
}

function drawClouds(hour) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const cloudOffset = (hour * 40) % CONFIG.canvasWidth;
    const clouds = [
        { x: 120, y: 50, w: 90, h: 26 },
        { x: 400, y: 80, w: 110, h: 30 },
        { x: 720, y: 45, w: 100, h: 28 },
        { x: 900, y: 100, w: 80, h: 24 }
    ];
    clouds.forEach(c => {
        const cx = ((c.x + cloudOffset) % (CONFIG.canvasWidth + 200)) - 100;
        ctx.fillRect(cx, c.y, c.w, c.h);
        ctx.fillRect(cx + 10, c.y - 8, c.w - 20, 8);
        ctx.fillRect(cx + 18, c.y - 14, c.w - 36, 6);
        ctx.fillStyle = 'rgba(200,200,200,0.45)';
        ctx.fillRect(cx + 4, c.y + c.h - 4, c.w - 8, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
    });
}

// --- 太阳 / 月亮 ---
function drawSun(hour) {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(hour, seasonData.noonAngle);

    if (altitude <= 0) {
        drawMoon(hour);
        return;
    }

    const azimuth = calcSunAzimuth(hour);
    const azRad = azimuth * Math.PI / 180;

    const centerX = CONFIG.canvasWidth / 2;
    const centerY = CONFIG.skyCenterY;
    const radius = CONFIG.skyRadius;

    const sunX = centerX + Math.sin(azRad) * radius;
    const sunY = centerY - Math.cos(azRad) * radius * 0.35 - altitude * 1.2;

    // 太阳光晕
    const glowSize = 65 + Math.sin(Date.now() / 500) * 4;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, glowSize);
    glow.addColorStop(0, 'rgba(255,230,120,0.85)');
    glow.addColorStop(0.5, 'rgba(255,190,60,0.35)');
    glow.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - glowSize, sunY - glowSize, glowSize * 2, glowSize * 2);

    // 太阳本体
    const sunSize = 44;
    if (state.images.sun && state.images.sun.complete) {
        ctx.drawImage(state.images.sun, sunX - sunSize / 2, sunY - sunSize / 2, sunSize, sunSize);
    } else {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(sunX - sunSize / 2, sunY - sunSize / 2, sunSize, sunSize);
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(sunX - sunSize / 2 + 4, sunY - sunSize / 2 + 4, sunSize - 8, sunSize - 8);
    }

    // 光线
    ctx.strokeStyle = 'rgba(255,230,120,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const angle = (Date.now() / 2000 + i * Math.PI / 4);
        const rayLen = 65;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(angle) * 24, sunY + Math.sin(angle) * 24);
        ctx.lineTo(sunX + Math.cos(angle) * rayLen, sunY + Math.sin(angle) * rayLen);
        ctx.stroke();
    }

    return { x: sunX, y: sunY };
}

function drawMoon(hour) {
    const centerX = CONFIG.canvasWidth / 2;
    const centerY = CONFIG.skyCenterY;
    const radius = CONFIG.skyRadius;

    const moonHour = (hour + 12) % 24;
    const moonAz = (moonHour - 12) * 15;
    const moonAzRad = moonAz * Math.PI / 180;

    const moonX = centerX + Math.sin(moonAzRad) * radius;
    const moonY = centerY - Math.cos(moonAzRad) * radius * 0.35;

    if (moonY > CONFIG.isoBaseY - 100) return;

    const moonSize = 34;

    const glow = ctx.createRadialGradient(moonX, moonY, 5, moonX, moonY, 42);
    glow.addColorStop(0, 'rgba(220,220,255,0.45)');
    glow.addColorStop(1, 'rgba(220,220,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(moonX - 42, moonY - 42, 84, 84);

    if (state.images.moon && state.images.moon.complete) {
        ctx.drawImage(state.images.moon, moonX - moonSize / 2, moonY - moonSize / 2, moonSize, moonSize);
    } else {
        ctx.fillStyle = '#DDDDDD';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#BBBBBB';
        ctx.beginPath();
        ctx.arc(moonX - 4, moonY - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(moonX + 5, moonY + 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    return { x: moonX, y: moonY };
}

// --- 2.5D 等角方块绘制 ---

/**
 * 绘制一个等角立方体（三个可见面）
 * cx, cy: 顶面中心屏幕坐标
 */
function drawIsoCube(cx, cy, tileW, tileH, depth, colors) {
    const halfW = tileW / 2;
    const halfH = tileH;

    // 顶面四个角
    const topPt    = { x: cx,         y: cy - halfH };
    const rightPt  = { x: cx + halfW, y: cy };
    const bottomPt = { x: cx,         y: cy + halfH };
    const leftPt   = { x: cx - halfW, y: cy };

    // 底面四个角
    const topDn    = { x: cx,         y: cy - halfH + depth };
    const rightDn  = { x: cx + halfW, y: cy + depth };
    const bottomDn = { x: cx,         y: cy + halfH + depth };
    const leftDn   = { x: cx - halfW, y: cy + depth };

    // 右侧面（东南侧，最暗）
    ctx.fillStyle = colors.right;
    ctx.beginPath();
    ctx.moveTo(rightPt.x, rightPt.y);
    ctx.lineTo(bottomPt.x, bottomPt.y);
    ctx.lineTo(bottomDn.x, bottomDn.y);
    ctx.lineTo(rightDn.x, rightDn.y);
    ctx.closePath();
    ctx.fill();

    // 左侧面（西北侧，中等亮度）
    ctx.fillStyle = colors.left;
    ctx.beginPath();
    ctx.moveTo(leftPt.x, leftPt.y);
    ctx.lineTo(topPt.x, topPt.y);
    ctx.lineTo(topDn.x, topDn.y);
    ctx.lineTo(leftDn.x, leftDn.y);
    ctx.closePath();
    ctx.fill();

    // 顶面（最亮）
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(topPt.x, topPt.y);
    ctx.lineTo(rightPt.x, rightPt.y);
    ctx.lineTo(bottomPt.x, bottomPt.y);
    ctx.lineTo(leftPt.x, leftPt.y);
    ctx.closePath();
    ctx.fill();

    // 顶面纹理（如有）
    if (colors.topPattern && state.images[colors.topPattern]) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(topPt.x, topPt.y);
        ctx.lineTo(rightPt.x, rightPt.y);
        ctx.lineTo(bottomPt.x, bottomPt.y);
        ctx.lineTo(leftPt.x, leftPt.y);
        ctx.closePath();
        ctx.clip();
        // 简单平铺纹理
        const img = state.images[colors.topPattern];
        const patW = tileW;
        const patH = tileH * 2;
        ctx.drawImage(img, cx - patW/2, cy - patH/2, patW, patH);
        ctx.restore();
    }

    // 边框线（像素风描边）
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(topPt.x, topPt.y);
    ctx.lineTo(rightPt.x, rightPt.y);
    ctx.lineTo(bottomPt.x, bottomPt.y);
    ctx.lineTo(leftPt.x, leftPt.y);
    ctx.closePath();
    ctx.stroke();
}

// --- 地面网格 ---

function drawIsoGroundTile(cx, cy, gridX, gridZ) {
    const tw = CONFIG.isoTileW;
    const th = CONFIG.isoTileH;
    const depth = CONFIG.isoBlockDepth;
    const halfW = tw / 2;

    // 草地颜色（带轻微随机变化）
    const seed = Math.abs(gridX * 7 + gridZ * 13) % 3;
    const baseColors = [
        { top: '#6CBD5C', left: '#52A048', right: '#3E8538' },
        { top: '#64B454', left: '#4A9840', right: '#387D30' },
        { top: '#5AAA50', left: '#44903C', right: '#327528' }
    ];
    const colors = baseColors[seed];

    // 中心点
    const topPt    = { x: cx,         y: cy - th };
    const rightPt  = { x: cx + halfW, y: cy };
    const bottomPt = { x: cx,         y: cy + th };
    const leftPt   = { x: cx - halfW, y: cy };

    const topDn    = { x: cx,         y: cy - th + depth };
    const rightDn  = { x: cx + halfW, y: cy + depth };
    const bottomDn = { x: cx,         y: cy + th + depth };
    const leftDn   = { x: cx - halfW, y: cy + depth };

    // 泥土层（向下延伸更多，模拟地面厚度）
    const dirtDepth = depth * 2;
    const rightDirt  = { x: cx + halfW, y: cy + dirtDepth };
    const bottomDirt = { x: cx,         y: cy + th + dirtDepth };
    const leftDirt   = { x: cx - halfW, y: cy + dirtDepth };

    // 右侧面（泥土）
    ctx.fillStyle = '#6B4E2A';
    ctx.beginPath();
    ctx.moveTo(rightPt.x, rightPt.y);
    ctx.lineTo(bottomPt.x, bottomPt.y);
    ctx.lineTo(bottomDirt.x, bottomDirt.y);
    ctx.lineTo(rightDirt.x, rightDirt.y);
    ctx.closePath();
    ctx.fill();

    // 左侧面（泥土）
    ctx.fillStyle = '#5C4220';
    ctx.beginPath();
    ctx.moveTo(leftPt.x, leftPt.y);
    ctx.lineTo(topPt.x, topPt.y);
    ctx.lineTo(topDn.x, topDn.y);
    ctx.lineTo(leftDn.x, leftDn.y);
    ctx.closePath();
    ctx.fill();

    // 草地顶面
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(topPt.x, topPt.y);
    ctx.lineTo(rightPt.x, rightPt.y);
    ctx.lineTo(bottomPt.x, bottomPt.y);
    ctx.lineTo(leftPt.x, leftPt.y);
    ctx.closePath();
    ctx.fill();

    // 草地侧面（草皮边缘）
    ctx.fillStyle = colors.left;
    ctx.beginPath();
    ctx.moveTo(leftPt.x, leftPt.y);
    ctx.lineTo(topPt.x, topPt.y);
    ctx.lineTo(topDn.x, topDn.y);
    ctx.lineTo(leftDn.x, leftDn.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.right;
    ctx.beginPath();
    ctx.moveTo(rightPt.x, rightPt.y);
    ctx.lineTo(bottomPt.x, bottomPt.y);
    ctx.lineTo(bottomDn.x, bottomDn.y);
    ctx.lineTo(rightDn.x, rightDn.y);
    ctx.closePath();
    ctx.fill();

    // 顶面草纹理点缀（像素点）
    ctx.fillStyle = 'rgba(100,200,80,0.3)';
    const dotSeed = Math.abs(gridX * 31 + gridZ * 17) % 7;
    for (let i = 0; i < 3 + dotSeed; i++) {
        const dx = ((gridX * 11 + i * 37) % 20) - 10;
        const dy = ((gridZ * 13 + i * 29) % 12) - 6;
        ctx.fillRect(cx + dx, cy + dy, 2, 2);
    }
}

// --- 标杆（方块堆叠） ---

function drawIsoPole() {
    const height = CONFIG.isoPoleHeight;
    const tw = CONFIG.isoTileW * 0.35;  // 标杆较细
    const th = CONFIG.isoTileH * 0.35;
    const depth = CONFIG.isoBlockDepth * 0.35;

    for (let layer = 0; layer < height; layer++) {
        const worldY = layer + 1; // 标杆第layer层的顶面在worldY=layer+1
        const pos = isoToScreen(0, worldY, 0);

        // 红白条纹
        const isRed = layer % 2 === 0;
        const colors = isRed
            ? { top: '#E84E4E', left: '#C43A3A', right: '#A02828' }
            : { top: '#F0F0F0', left: '#D8D8D8', right: '#C0C0C0' };

        drawIsoCube(pos.x, pos.y, tw, th, depth, colors);
    }

    // 标杆顶部小红帽
    const topPos = isoToScreen(0, height + 0.3, 0);
    const capColors = { top: '#FF3333', left: '#CC2222', right: '#AA1111' };
    drawIsoCube(topPos.x, topPos.y, tw * 1.1, th * 1.1, depth * 0.6, capColors);
}

// --- 2.5D 影子 ---

function drawIsoShadow() {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(state.hour, seasonData.noonAngle);
    if (altitude <= 0.5) return;

    const poleHeight = CONFIG.isoPoleHeight;
    const rad = altitude * Math.PI / 180;
    const shadowWorldLen = (poleHeight / Math.tan(rad)) * CONFIG.shadowScale;

    const sunAz = calcSunAzimuth(state.hour);
    const shadowAz = (sunAz + 180) % 360;
    const shadowRad = shadowAz * Math.PI / 180;

    // 影子终点世界坐标
    const dx = Math.sin(shadowRad) * shadowWorldLen;
    const dz = -Math.cos(shadowRad) * shadowWorldLen;

    // 起点（标杆底部中心，略微浮起避免z-fighting）
    const startW = { x: 0, y: 0.08, z: 0 };
    const endW = { x: dx, y: 0.08, z: dz };

    // 影子宽度
    const halfWidth = 0.35;
    const len = Math.sqrt(dx * dx + dz * dz);
    let perpX = 0, perpZ = 0;
    if (len > 0.01) {
        perpX = -dz / len * halfWidth;
        perpZ = dx / len * halfWidth;
    }

    // 四边形四个角（起点宽 → 末端窄）
    const corners = [
        { x: startW.x + perpX, y: 0.08, z: startW.z + perpZ, alpha: 0.38 },
        { x: startW.x - perpX, y: 0.08, z: startW.z - perpZ, alpha: 0.38 },
        { x: endW.x - perpX * 0.25, y: 0.08, z: endW.z - perpZ * 0.25, alpha: 0.15 },
        { x: endW.x + perpX * 0.25, y: 0.08, z: endW.z + perpZ * 0.25, alpha: 0.15 }
    ];

    const screenCorners = corners.map(c => isoToScreen(c.x, c.y, c.z));

    // 主体影子（带渐变透明度）
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
    for (let i = 1; i < screenCorners.length; i++) {
        ctx.lineTo(screenCorners[i].x, screenCorners[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // 影子边缘虚线
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 影子末端标记点
    const endScreen = isoToScreen(endW.x, endW.y, endW.z);
    ctx.fillStyle = 'rgba(244, 209, 66, 0.5)';
    ctx.beginPath();
    ctx.arc(endScreen.x, endScreen.y, 3, 0, Math.PI * 2);
    ctx.fill();

    return { start: isoToScreen(startW.x, startW.y, startW.z), end: endScreen };
}

// --- 光线指示（太阳 → 标杆顶部） ---

function drawLightRay(sunPos) {
    if (!sunPos) return;
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(state.hour, seasonData.noonAngle);
    if (altitude <= 0) return;

    // 标杆顶部等角坐标
    const poleTop = isoToScreen(0, CONFIG.isoPoleHeight + 0.5, 0);

    // 只画在场景区域内的部分
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 230, 100, 0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(sunPos.x, sunPos.y);
    ctx.lineTo(poleTop.x, poleTop.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

// --- 方向标签 ---

function drawDirectionLabels() {
    const labels = [
        { text: '北', x: 0, z: -CONFIG.isoGridRadius - 0.8, color: '#ff6666' },
        { text: '南', x: 0, z: CONFIG.isoGridRadius + 0.8, color: '#aaaaff' },
        { text: '东', x: CONFIG.isoGridRadius + 0.8, z: 0, color: '#aaffaa' },
        { text: '西', x: -CONFIG.isoGridRadius - 0.8, z: 0, color: '#ffffaa' }
    ];

    ctx.font = 'bold 14px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach(lbl => {
        const pos = isoToScreen(lbl.x, 0, lbl.z);
        // 文字阴影
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(lbl.text, pos.x + 1, pos.y + 1);
        ctx.fillStyle = lbl.color;
        ctx.fillText(lbl.text, pos.x, pos.y);
    });
}

// --- 标尺（地面网格上的距离刻度） ---

function drawGroundRuler() {
    const z = CONFIG.isoGridRadius + 1.2;
    const startX = -2;
    const endX = 2;

    const startPos = isoToScreen(startX, 0, z);
    const endPos = isoToScreen(endX, 0, z);

    ctx.save();
    ctx.strokeStyle = 'rgba(244,209,66,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(244,209,66,0.6)';
    ctx.font = 'bold 11px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';

    for (let m = 0; m <= 4; m++) {
        const t = m / 4;
        const wx = startX + (endX - startX) * t;
        const pos = isoToScreen(wx, 0, z);
        ctx.fillRect(pos.x - 1, pos.y - 4, 2, 8);
        ctx.fillText(m + 'm', pos.x, pos.y + 16);
    }
    ctx.restore();
}

// --- 主场景渲染 ---

function drawIsoScene() {
    const radius = CONFIG.isoGridRadius;
    const tiles = [];

    // 收集所有地面格子
    for (let z = -radius; z <= radius; z++) {
        for (let x = -radius; x <= radius; x++) {
            const pos = isoToScreen(x, 0, z);
            tiles.push({ x, z, screenX: pos.x, screenY: pos.y });
        }
    }

    // 按深度排序（从远到近）
    tiles.sort((a, b) => (a.screenY + a.screenX * 0.5) - (b.screenY + b.screenX * 0.5));

    // 绘制地面
    tiles.forEach(tile => {
        drawIsoGroundTile(tile.screenX, tile.screenY, tile.x, tile.z);
    });

    // 绘制影子（在地面上，标杆之前）
    const shadowEnd = drawIsoShadow();

    // 绘制标杆（方块堆叠）
    drawIsoPole();

    // 绘制标尺
    drawGroundRuler();

    // 方向标签
    drawDirectionLabels();
}

function render() {
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // 1. 天空背景
    drawSky(state.hour);

    // 2. 太阳/月亮（返回位置用于光线指示）
    const sunPos = drawSun(state.hour);

    // 3. 2.5D 等角场景
    drawIsoScene();

    // 4. 光线指示（在场景之上覆盖）
    drawLightRay(sunPos);
}

// ===== UI 更新 =====

function updateDataPanel() {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(state.hour, seasonData.noonAngle);
    const azimuth = calcSunAzimuth(state.hour);
    const shadowLen = altitude > 0 ? calcShadowLength(altitude, CONFIG.isoPoleHeight * 12) : null;
    const direction = calcShadowDirection(azimuth);

    const h = Math.floor(state.hour);
    const m = Math.floor((state.hour - h) * 60);
    document.getElementById('timeDisplay').textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    const phaseData = KNOWLEDGE_DB[h] || KNOWLEDGE_DB[0];
    document.getElementById('timePhase').textContent = phaseData.phase;

    if (altitude > 0) {
        document.getElementById('angleDisplay').textContent = altitude.toFixed(1) + '°';
        if (altitude > 70) document.getElementById('angleDesc').textContent = '太阳接近天顶';
        else if (altitude > 40) document.getElementById('angleDesc').textContent = '太阳高度适中';
        else document.getElementById('angleDesc').textContent = '太阳较低';
    } else {
        document.getElementById('angleDisplay').textContent = '--';
        document.getElementById('angleDesc').textContent = '太阳在地平线以下';
    }

    if (shadowLen !== null) {
        const realLen = (shadowLen / 80).toFixed(2);
        document.getElementById('shadowDisplay').textContent = realLen + 'm';
        if (shadowLen < 30) document.getElementById('shadowDesc').textContent = '影子很短';
        else if (shadowLen < 80) document.getElementById('shadowDesc').textContent = '影子中等';
        else document.getElementById('shadowDesc').textContent = '影子很长';
    } else {
        document.getElementById('shadowDisplay').textContent = '--';
        document.getElementById('shadowDesc').textContent = '无阳光照射';
    }

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
    const pct = (state.hour / 24) * 100;
    document.getElementById('timelineProgress').style.width = pct + '%';
    document.getElementById('timelineCurrent').style.left = pct + '%';

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
        const len = alt > 0 ? calcShadowLength(alt, CONFIG.isoPoleHeight * 12) : null;
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

    const speed = state.playSpeed === 2 ? 3 : 1;
    state.hour += dt * speed;

    if (state.hour >= 24) state.hour = 0;

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
    if (!isVisible) updateReportTable();
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

    document.querySelector('.timeline-track').addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = x / rect.width;
        setHour(pct * 24);
    });

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
    // 调整Canvas尺寸
    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;

    buildTimeline();
    bindEvents();
    await preloadImages();
    setHour(12);
    updateReportTable();

    window.addEventListener('resize', () => {
        render();
    });
}

init();
