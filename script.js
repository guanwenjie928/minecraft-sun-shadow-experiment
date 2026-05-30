/**
 * Minecraft 太阳光与影子科学实验 — Three.js 3D 引擎
 *
 * 核心特性：
 *   1024² Minecraft方块纹理 → 真3D立方体贴图
 *   DirectionalLight + ShadowMap → 实时阴影
 *   OrbitControls → 自由旋转/缩放/平移视角
 *   太阳球体可见 + 24h轨迹 + 季节差异
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== 配置 =====
const CONFIG = {
    lat: 40,
    seasons: {
        winter:  { name: '冬至', declination: -23.5, noonAngle: 26.5 },
        equinox: { name: '春分/秋分', declination: 0, noonAngle: 50 },
        summer:  { name: '夏至', declination: 23.5, noonAngle: 73.5 }
    },
    gridRadius: 3,    // 3 → 7×7 地面
    poleHeight: 6,    // 标杆高度（方块数）
    sunDist: 22       // 太阳光源距离
};

// ===== 状态 =====
let state = {
    hour: 12,
    season: 'equinox',
    isPlaying: false,
    playSpeed: 1,
    images: {}
};

// ===== 3D 对象引用 =====
let scene, camera, renderer, controls;
let sunLight, sunSphere;
let poleGroup, groundGroup;

// ===== 知识库 =====
const KNOWLEDGE_DB = {
    0: { phase: '午夜', text: '太阳在地平线以下，月光照亮地面。影子由月光产生，但由于月光很弱，通常难以观察。' },
    1: { phase: '凌晨', text: '太阳仍在地平线以下，天空开始微微发亮（曙光）。此时没有太阳光产生的影子。' },
    2: { phase: '凌晨', text: '天边开始出现鱼肚白，太阳即将升起。' },
    3: { phase: '凌晨', text: '黎明前的黑暗即将过去。古代人们用圭表观测日影来确定时间。' },
    4: { phase: '拂晓', text: '天快亮了！太阳即将从东方升起。古人说的"鸡鸣而起"大约就是这个时间。' },
    5: { phase: '拂晓', text: '太阳即将升起！如果朝东方看，会看到美丽的朝霞。' },
    6: { phase: '日出', text: '🌅 太阳从东方升起！<strong>影子朝向正西</strong>，而且非常长——高度角很小，光线几乎是平着照射的。' },
    7: { phase: '早晨', text: '太阳在东偏南方向，高度角逐渐增大。<strong>影子朝向西北</strong>，长度开始缩短。' },
    8: { phase: '上午', text: '太阳继续升高，<strong>影子继续缩短</strong>。此时阳光中的紫外线还不算太强。' },
    9: { phase: '上午', text: '太阳高度角已经相当可观，影子明显变短。如果用日晷计时，晷针影子会落在上午刻度上。' },
    10: { phase: '上午', text: '临近正午，太阳接近正南方天空最高点。<strong>影子快速缩短</strong>中。' },
    11: { phase: '上午', text: '马上就要正午了！太阳高度角接近一天中的最大值，影子也变得很短。古人称此时为"隅中"。' },
    12: { phase: '正午', text: '☀️ <strong>正午时分！</strong>太阳位于正南方最高点，<strong>太阳高度角最大，影子最短</strong>，朝向正北。' },
    13: { phase: '午后', text: '午后时分，太阳从最高点向西偏移。<strong>影子逐渐变长</strong>，方向从正北转向东北。' },
    14: { phase: '下午', text: '下午的太阳在西偏南方向，影子朝向东北且继续变长。' },
    15: { phase: '下午', text: '下午三点左右，太阳高度角明显降低，影子长度约是正午的1.5倍。' },
    16: { phase: '下午', text: '临近傍晚，太阳接近西方地平线，<strong>影子快速变长</strong>。' },
    17: { phase: '傍晚', text: '太阳快落山了！高度角很低，<strong>影子变得很长</strong>，朝向东北偏东。这是"金色时刻"！' },
    18: { phase: '日落', text: '🌇 <strong>日落西山！</strong>太阳从西方落下，<strong>影子朝向正东</strong>，非常长。古人称"日入"。' },
    19: { phase: '黄昏', text: '太阳刚落山，天空还有余晖（暮光）。此时没有太阳直射光。' },
    20: { phase: '晚上', text: '夜幕降临，星星开始出现。古人用月相和星辰位置来判断时间。' },
    21: { phase: '晚上', text: '夜晚深了，月亮高挂天空。月光也会产生影子，但比日影淡得多。' },
    22: { phase: '深夜', text: '夜深人静。在古代，守夜人会根据星辰位置报时。' },
    23: { phase: '深夜', text: '午夜前的宁静时刻。新的一天即将到来，太阳将在几小时后再次升起。' },
    24: { phase: '午夜', text: '太阳在地平线正下方（子夜），影子完全消失。一天的光影之旅完成！' }
};

// ===== 数学 =====
function calcSunAltitude(hour, noonAngle) {
    if (hour < 6 || hour > 18) return -1;
    const t = (hour - 12) * 15;
    const rad = t * Math.PI / 180;
    return Math.max(0, noonAngle * Math.cos(rad));
}

function calcSunAzimuth(hour) {
    if (hour < 6 || hour > 18) return null;
    return (hour - 12) * 15;
}

function getDirectionText(hour) {
    const az = calcSunAzimuth(hour);
    if (az === null) return '无';
    // 影子方向 = 太阳方位 + 180°
    const shadowAz = (az + 180) % 360;
    if (shadowAz >= 350 || shadowAz <= 10) return '正北';
    if (shadowAz > 10 && shadowAz < 80) return '北偏东';
    if (shadowAz >= 80 && shadowAz <= 100) return '正东';
    if (shadowAz > 100 && shadowAz < 170) return '南偏东';
    if (shadowAz >= 170 && shadowAz <= 190) return '正南';
    if (shadowAz > 190 && shadowAz < 260) return '南偏西';
    if (shadowAz >= 260 && shadowAz <= 280) return '正西';
    if (shadowAz > 280 && shadowAz < 350) return '北偏西';
    return '正北';
}

function getSkyColor(hour) {
    if (hour >= 7 && hour < 17)
        return { top: '#4a90d9', bottom: '#87CEEB', ambient: 0x606080, lightColor: 0xfff5e0, lightIntensity: 2.5 };
    if ((hour >= 5 && hour < 7) || (hour >= 17 && hour < 19))
        return { top: '#6b3a5c', bottom: '#FF8C42', ambient: 0x403040, lightColor: 0xffc080, lightIntensity: 1.5 };
    return { top: '#0a0a1a', bottom: '#1a1a2e', ambient: 0x101020, lightColor: 0x8080c0, lightIntensity: 0.3 };
}

// ===== Three.js 初始化 =====
function initThreeJS() {
    const container = document.getElementById('threeContainer');
    const w = container.clientWidth;
    const h = container.clientHeight;

    // 场景
    scene = new THREE.Scene();

    // 相机
    camera = new THREE.PerspectiveCamera(45, w / h, 1, 100);
    camera.position.set(10, 8, 10);
    camera.lookAt(0, 2, 0);

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // OrbitControls - 旋转缩放
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.75;
    controls.update();

    // 环境光
    const ambient = new THREE.AmbientLight(0x606080, 2.0);
    scene.add(ambient);

    // 太阳平行光 (主光源 + 阴影)
    sunLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -14;
    sunLight.shadow.camera.right = 14;
    sunLight.shadow.camera.top = 14;
    sunLight.shadow.camera.bottom = -14;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);
    sunLight.target.position.set(0, 0, 0);

    // 太阳球体（可见）
    const sunGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    sunSphere = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunSphere);
    // 太阳光晕
    const glowGeo = new THREE.SphereGeometry(0.8, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.3 });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    sunSphere.add(glowSphere);

    // 地面接收面（用于干净影子）
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    floor.name = 'shadowFloor';
    scene.add(floor);

    // 场景构建
    groundGroup = new THREE.Group();
    scene.add(groundGroup);
    buildGround();

    poleGroup = new THREE.Group();
    scene.add(poleGroup);
    buildPole();

    // 初始天空颜色
    updateSkyAndLight(state.hour);
}

// ===== 纹理加载 =====
const texLoader = new THREE.TextureLoader();
texLoader.setPath('assets/textures/');

function loadTexture(path, fallbackColor) {
    const tex = texLoader.load(path,
        undefined, undefined,
        () => { /* onError - will use fallback */ }
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// 预加载所有纹理
const TEX = {
    grassTop: loadTexture('grass-top.jpg'),
    grassSide: loadTexture('grass-side.jpg'),
    dirt: loadTexture('dirt.jpg'),
    pole: loadTexture('pole.jpg'),
    sand: loadTexture('sand.jpg'),
    stone: loadTexture('cobblestone.jpg'),
    planks: loadTexture('oak-planks.jpg')
};

// ===== 地面网格 =====
function buildGround() {
    groundGroup.clear();
    const r = CONFIG.gridRadius;

    for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
            const isCenter = (x === 0 && z === 0);

            // 每个方块的面材质
            const topMat = new THREE.MeshStandardMaterial({
                map: TEX.grassTop,
                roughness: 0.85,
                metalness: 0.0
            });
            const sideMat = new THREE.MeshStandardMaterial({
                map: TEX.grassSide,
                roughness: 0.9,
                metalness: 0.0
            });
            const bottomMat = new THREE.MeshStandardMaterial({
                map: TEX.dirt,
                roughness: 1.0,
                metalness: 0.0
            });

            const materials = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];

            const geo = new THREE.BoxGeometry(0.96, 0.22, 0.96);
            const block = new THREE.Mesh(geo, materials);
            block.position.set(x, 0.11, z);
            block.castShadow = false;
            block.receiveShadow = true;
            block.name = `ground-${x}-${z}`;
            groundGroup.add(block);
        }
    }

    // 中央小底座（深色石头）
    const baseGeo = new THREE.BoxGeometry(1.1, 0.05, 1.1);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, 0.22, 0);
    base.receiveShadow = true;
    base.name = 'baseMarker';
    groundGroup.add(base);
}

// ===== 标杆（方块堆叠） =====
function buildPole() {
    poleGroup.clear();
    const h = CONFIG.poleHeight;
    const poleSize = 0.2;

    // 使用条纹杆纹理
    const redMat = new THREE.MeshStandardMaterial({
        map: TEX.pole,
        roughness: 0.4,
        metalness: 0.1
    });
    const whiteMat = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.5,
        metalness: 0.1
    });

    for (let i = 0; i < h; i++) {
        const mat = i % 2 === 0 ? redMat : whiteMat;
        const materials = [mat, mat, mat, mat, mat, mat];
        const geo = new THREE.BoxGeometry(poleSize, 1.0, poleSize);
        const block = new THREE.Mesh(geo, materials);
        block.position.set(0, 0.22 + i + 0.5, 0);
        block.castShadow = true;
        block.receiveShadow = true;
        block.name = `pole-${i}`;
        poleGroup.add(block);
    }

    // 顶部小红帽
    const capGeo = new THREE.BoxGeometry(poleSize * 1.3, 0.25, poleSize * 1.3);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.3 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.22 + h + 0.63, 0);
    cap.castShadow = true;
    cap.receiveShadow = true;
    cap.name = 'poleCap';
    poleGroup.add(cap);
}

// ===== 太阳位置更新 =====
function updateSunAndSky() {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(state.hour, seasonData.noonAngle);
    const azimuth = calcSunAzimuth(state.hour);

    // 方向：北=Z-, 东=X+, 南=Z+, 西=X-
    if (altitude > 0) {
        const azRad = THREE.MathUtils.degToRad(azimuth || 0);
        const altRad = THREE.MathUtils.degToRad(altitude);

        const dist = CONFIG.sunDist;
        const sx = Math.sin(azRad) * Math.cos(altRad) * dist;
        const sy = Math.sin(altRad) * dist;
        const sz = -Math.cos(azRad) * Math.cos(altRad) * dist;

        sunLight.position.set(sx, sy, sz);
        sunSphere.position.set(sx, sy, sz);
        sunSphere.visible = true;

        const sky = getSkyColor(state.hour);
        sunLight.intensity = sky.lightIntensity * (0.3 + 0.7 * Math.sin(altRad));
        sunLight.color.set(sky.lightColor);
    } else {
        sunSphere.visible = false;
        sunLight.intensity = 0.05;
    }

    updateSkyAndLight(state.hour);
}

function updateSkyAndLight(hour) {
    const sky = getSkyColor(hour);

    // 天空背景
    if (hour >= 7 && hour < 17) {
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, 25, 70);
    } else if ((hour >= 5 && hour < 7) || (hour >= 17 && hour < 19)) {
        scene.background = new THREE.Color(0xe8845a);
        scene.fog = new THREE.Fog(0xe8845a, 15, 55);
    } else {
        scene.background = new THREE.Color(0x1a1a2e);
        scene.fog = new THREE.Fog(0x1a1a2e, 10, 45);
    }

    // 环境光跟随天空
    const ambient = scene.children.find(c => c.isAmbientLight);
    if (ambient) ambient.intensity = hour >= 6 && hour <= 18 ? 2.0 : 0.5;
}

// ===== 渲染循环 =====
let animFrame;
function animate() {
    animFrame = requestAnimationFrame(animate);
    controls.update();
    updateSunAndSky();
    renderer.render(scene, camera);
}

// ===== UI 更新 =====
function updateDataPanel() {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(state.hour, seasonData.noonAngle);

    const h = Math.floor(state.hour);
    const m = Math.floor((state.hour - h) * 60);
    document.getElementById('timeDisplay').textContent =
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

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

    // 影长
    if (altitude > 0) {
        const rad = altitude * Math.PI / 180;
        const shadowLen = CONFIG.poleHeight / Math.tan(rad);
        document.getElementById('shadowDisplay').textContent = (shadowLen / 6).toFixed(2) + 'm';
        if (shadowLen < 4) document.getElementById('shadowDesc').textContent = '影子很短';
        else if (shadowLen < 12) document.getElementById('shadowDesc').textContent = '影子中等';
        else document.getElementById('shadowDesc').textContent = '影子很长';
    } else {
        document.getElementById('shadowDisplay').textContent = '--';
        document.getElementById('shadowDesc').textContent = '无阳光照射';
    }

    // 方向
    if (altitude > 0) {
        document.getElementById('directionDisplay').textContent = getDirectionText(state.hour);
        document.getElementById('directionDesc').textContent = '与太阳方向相反';
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
        const btnH = parseInt(btn.dataset.hour);
        btn.classList.toggle('active', Math.floor(state.hour) === btnH);
    });
}

function updateReportTable() {
    const tbody = document.getElementById('reportBody');
    tbody.innerHTML = '';
    const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

    hours.forEach(h => {
        const seasonData = CONFIG.seasons[state.season];
        const alt = calcSunAltitude(h, seasonData.noonAngle);

        let sunPos = h < 12 ? '东偏南' : (h === 12 ? '正南' : '西偏南');
        let rule = (h === 6 || h === 18) ? '日出/日落最长' :
            (h === 12) ? '正午最短' : (h < 12 ? '上午渐短' : '下午渐长');

        let altStr = '--', dirStr = '--', lenStr = '--';
        if (alt > 0) {
            altStr = alt.toFixed(1) + '°';
            dirStr = getDirectionText(h);
            const rad = alt * Math.PI / 180;
            lenStr = (CONFIG.poleHeight / Math.tan(rad) / 6).toFixed(2) + 'm';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${h}:00</td><td>${sunPos}</td><td>${altStr}</td><td>${dirStr}</td><td>${lenStr}</td><td>${rule}</td>`;
        tbody.appendChild(tr);
    });
}

// ===== 时间轴构建 =====
function buildTimeline() {
    const container = document.getElementById('timelineHours');
    container.innerHTML = '';

    for (let h = 0; h <= 24; h++) {
        const btn = document.createElement('button');
        btn.className = 'hour-btn' + (h < 6 || h > 18 ? ' night' : '');
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

// ===== 控制 =====
function setHour(h) {
    state.hour = Math.max(0, Math.min(24, h));
    updateDataPanel();
    updateKnowledge();
    updateTimelineUI();
}

function setSeason(season) {
    state.season = season;
    document.querySelectorAll('.season-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.season === season));
    updateDataPanel();
    updateKnowledge();
    updateReportTable();
}

function togglePlay() {
    state.isPlaying = !state.isPlaying;
    const btnPlay = document.getElementById('btnPlay');
    const btnPause = document.getElementById('btnPause');
    btnPlay.style.display = state.isPlaying ? 'none' : '';
    btnPause.style.display = state.isPlaying ? '' : 'none';
    if (state.isPlaying) playLoop();
}

let playTimeout;
function playLoop() {
    if (!state.isPlaying) return;
    const speed = state.playSpeed === 2 ? 3 : 1;
    state.hour += 0.1 * speed;
    if (state.hour >= 24) state.hour = 0;
    updateDataPanel();
    updateTimelineUI();
    playTimeout = setTimeout(playLoop, 80);
}

function resetExperiment() {
    state.isPlaying = false;
    clearTimeout(playTimeout);
    document.getElementById('btnPlay').style.display = '';
    document.getElementById('btnPause').style.display = 'none';
    state.playSpeed = 1;
    setHour(12);
}

function toggleFast() {
    state.playSpeed = state.playSpeed === 2 ? 1 : 2;
    document.getElementById('btnFast').style.borderColor =
        state.playSpeed === 2 ? '#F4D142' : '#555';
}

function toggleReport() {
    const wrapper = document.getElementById('reportWrapper');
    wrapper.style.display = wrapper.style.display === 'none' ? 'block' : 'none';
    if (wrapper.style.display !== 'none') updateReportTable();
}

// ===== 事件 =====
function bindEvents() {
    document.getElementById('btnPlay').addEventListener('click', togglePlay);
    document.getElementById('btnPause').addEventListener('click', togglePlay);
    document.getElementById('btnReset').addEventListener('click', resetExperiment);
    document.getElementById('btnFast').addEventListener('click', toggleFast);
    document.getElementById('btnReport').addEventListener('click', toggleReport);

    document.querySelectorAll('.season-btn').forEach(btn =>
        btn.addEventListener('click', () => setSeason(btn.dataset.season)));

    document.querySelector('.timeline-track').addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setHour((x / rect.width) * 24);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') setHour(state.hour - 0.5);
        if (e.key === 'ArrowRight') setHour(state.hour + 0.5);
        if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    });

    // 响应式
    window.addEventListener('resize', () => {
        const container = document.getElementById('threeContainer');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// ===== 启动 =====
async function init() {
    initThreeJS();
    buildTimeline();
    bindEvents();
    setHour(12);
    updateReportTable();
    animate();
}

init();
