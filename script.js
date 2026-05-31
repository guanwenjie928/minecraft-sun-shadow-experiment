/**
 * Minecraft 太阳光与影子科学实验 — Three.js 强化版
 *
 * 升级内容：
 *   Bloom 辉光后处理 → 太阳光晕
 *   动态天空球 (渐变 Canvas) → 从拂晓到深夜平滑过渡
 *   大气粒子系统 → 浮尘在阳光下飘动
 *   太阳轨迹线 → 可视化太阳的天空路径
 *   2048×2048 ShadowMap + ACES 色调映射
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ===== 配置 =====
const CONFIG = {
    lat: 40,
    seasons: {
        winter:  { name: '冬至', declination: -23.5, noonAngle: 26.5, desc: '太阳直射南回归线，北半球影子全年最长', key: 'winter' },
        equinox: { name: '春分/秋分', declination: 0, noonAngle: 50, desc: '太阳直射赤道，昼夜等长，影子适中', key: 'equinox' },
        summer:  { name: '夏至', declination: 23.5, noonAngle: 73.5, desc: '太阳直射北回归线，北半球影子全年最短', key: 'summer' }
    },
    gridRadius: 3,
    poleHeight: 6,
    sunDist: 22
};

// ===== 状态 =====
let state = {
    hour: 12,
    season: 'equinox',
    isPlaying: false,
    playSpeed: 1
};

// ===== 3D 对象 =====
let scene, camera, renderer, controls;
let sunLight, sunSphere, skyDome;
let poleGroup, groundGroup;
let particleSystem;
let composer, bloomPass;
let sunTrailLine;

// ===== 知识库 =====
const KNOWLEDGE_DB = {
    0: { phase: '午夜', text: '太阳在地平线以下。月光也能产生影子，但非常微弱。古人用"子时"标记一日之始。' },
    1: { phase: '凌晨', text: '深夜时分，太阳深在地平线以下。古代守夜人以星宿位置推算时辰。' },
    2: { phase: '凌晨', text: '万籁俱寂。再过几个时辰，东方天际将泛起第一抹鱼肚白。' },
    3: { phase: '凌晨', text: '黎明前的黑暗。中国古代圭表测影法正是在日出后开始观测日影方位。' },
    4: { phase: '拂晓', text: '天色微明！天空东侧出现曙光，大气散射让天空开始变亮。' },
    5: { phase: '拂晓', text: '太阳即将升起。古人称"平旦"，新的一天即将开始。朝霞预示着晴朗天气。' },
    6: { phase: '日出', text: '🌅 <strong>太阳从东方升起！</strong>高度角很低，光线近乎水平，<strong>影子朝向正西</strong>且极长。这就是为什么清晨拍照容易拉出长影。' },
    7: { phase: '早晨', text: '太阳来到东偏南方向。高度角快速增大，<strong>影子方向=西北</strong>，长度迅速缩短中。' },
    8: { phase: '上午', text: '太阳稳步攀升。影长约等于杆高的1.7倍（春分日），方向指向西北偏北。古人用"辰时"标记此段。' },
    9: { phase: '上午', text: '日上三竿！太阳高度角可观，身体投影只有身高的一半左右。紫外线开始增强。' },
    10: { phase: '上午', text: '阳光日渐强烈。影子方向逐渐偏向正北，长度持续收缩。此时日晷指针落在上午刻度区。' },
    11: { phase: '上午', text: '临近正午！太阳接近正南方制高点。古代称"隅中"，是上午最后一个时辰。影子只剩杆高的 0.7 倍左右。' },
    12: { phase: '正午', text: '☀️ <strong>正午时分！</strong>太阳位于正南最高点，<strong>太阳高度角达到一日最大，影子最短且指向正北</strong>。古人立竿测影正是在此刻读数。' },
    13: { phase: '午后', text: '午后太阳从最高点西移。<strong>影子开始变长</strong>，方向由正北偏向东北。午后一点仍是高温时段。' },
    14: { phase: '下午', text: '太阳西偏南方向运行。影子长度约回到杆高水平，方向朝向东北。日晷进入下午刻度。' },
    15: { phase: '下午', text: '下午三点左右。高度角明显下降至约35°，影长约为正午的1.5倍。气温开始回落。' },
    16: { phase: '下午', text: '日渐西斜！<strong>影子快速拉长</strong>，方向指向东北偏东。阳光变成宜人的暖金色。' },
    17: { phase: '傍晚', text: '金色时刻！太阳接近西方地平线，光线呈暖橙色。高度角极低，<strong>影子极长</strong>，方向几乎正东。' },
    18: { phase: '日落', text: '🌇 <strong>日落西山！</strong>太阳从西方沉入地平线。<strong>影子朝正东，长度达到最大</strong>。古人称"日入"，标志着夜晚的开始。' },
    19: { phase: '黄昏', text: '暮光时分。太阳已在地平线以下，但天空仍有散射余晖。大气散射蓝紫色光，天空呈现瑰丽暮色。' },
    20: { phase: '晚上', text: '夜幕低垂。星星开始在暗蓝色天幕上闪烁。月光虽然较弱，但满月时也能投影出淡淡影子。' },
    21: { phase: '晚上', text: '夜色深沉。古人常根据北斗七星与北极星的位置判断方向和大致时辰。' },
    22: { phase: '深夜', text: '夜深人静。在没有电灯的时代，月光是夜间主要光源。月影方向与日影原理相同。' },
    23: { phase: '深夜', text: '午夜前夕。再过一小时新的一轮太阳光影循环即将开始。这就是日复一日的天文规律。' },
    24: { phase: '午夜', text: '完整的 24 小时光影循环完成！从拂晓到正午到日落到深夜——理解了这个规律，就理解了古人"日出而作、日落而息"背后的天文原理。' }
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
    const shadowAz = (az + 180) % 360;
    if (shadowAz >= 350 || shadowAz <= 10) return '正北';
    if (shadowAz > 10 && shadowAz < 80) return '东北偏北';
    if (shadowAz >= 80 && shadowAz <= 100) return '正东';
    if (shadowAz > 100 && shadowAz < 170) return '东南偏东';
    if (shadowAz >= 170 && shadowAz <= 190) return '正南';
    if (shadowAz > 190 && shadowAz < 260) return '西南偏南';
    if (shadowAz >= 260 && shadowAz <= 280) return '正西';
    if (shadowAz > 280 && shadowAz < 350) return '西北偏北';
    return '正北';
}

// ===== 天空颜色系统 =====
function getTimeColors(hour) {
    // 返回 { skyTop, skyHorizon, fogColor, ambientColor, ambientIntensity, sunColor }
    if (hour < 4) {
        return { skyTop: '#0a0a20', skyHorizon: '#0d0d28', fogColor: 0x0a0a20, ambientColor: 0x1a1a3a, ambientIntensity: 0.3, sunColor: 0x8888bb };
    }
    if (hour < 5.5) {
        // 黎明前深蓝
        const t = (hour - 4) / 1.5;
        return { skyTop: lerpColor('#0a0a20', '#1a2a4a', t), skyHorizon: lerpColor('#0d0d28', '#2a3a5a', t), fogColor: lerpColorHex(0x0a0a20, 0x1a2a4a, t), ambientColor: lerpColorHex(0x1a1a3a, 0x2a3a5a, t), ambientIntensity: 0.3 + t * 0.4, sunColor: 0xcc9966 };
    }
    if (hour < 6.5) {
        // 日出
        const t = (hour - 5.5) / 1.0;
        return { skyTop: lerpColor('#1a2a4a', '#4a6a8a', t), skyHorizon: lerpColor('#2a3a5a', '#ff8844', t), fogColor: lerpColorHex(0x1a2a4a, 0x4a6a8a, t), ambientColor: lerpColorHex(0x2a3a5a, 0x5a4a3a, t), ambientIntensity: 0.7 + t * 0.5, sunColor: lerpColorHex(0xcc9966, 0xffcc66, t) };
    }
    if (hour < 8) {
        // 早晨
        const t = (hour - 6.5) / 1.5;
        return { skyTop: lerpColor('#4a6a8a', '#5599cc', t), skyHorizon: lerpColor('#ff8844', '#aaccff', t), fogColor: lerpColorHex(0x4a6a8a, 0x5599cc, t), ambientColor: lerpColorHex(0x5a4a3a, 0x6688aa, t), ambientIntensity: 1.2 + t * 0.4, sunColor: lerpColorHex(0xffcc66, 0xfff5e0, t) };
    }
    if (hour < 16) {
        // 白天
        return { skyTop: '#5599cc', skyHorizon: '#aaccff', fogColor: 0x87ceeb, ambientColor: 0x6688aa, ambientIntensity: 1.6, sunColor: 0xfff5e0 };
    }
    if (hour < 17.5) {
        // 下午偏晚
        const t = (hour - 16) / 1.5;
        return { skyTop: lerpColor('#5599cc', '#4a6a8a', t), skyHorizon: lerpColor('#aaccff', '#ffaa66', t), fogColor: lerpColorHex(0x87ceeb, 0xddaa77, t), ambientColor: lerpColorHex(0x6688aa, 0x5a4a3a, t), ambientIntensity: 1.6 - t * 0.3, sunColor: lerpColorHex(0xfff5e0, 0xffcc66, t) };
    }
    if (hour < 18.5) {
        // 日落
        const t = (hour - 17.5) / 1.0;
        return { skyTop: lerpColor('#4a6a8a', '#2a2040', t), skyHorizon: lerpColor('#ffaa66', '#ff4422', t), fogColor: lerpColorHex(0xddaa77, 0x553322, t), ambientColor: lerpColorHex(0x5a4a3a, 0x3a2a2a, t), ambientIntensity: 1.3 - t * 0.7, sunColor: lerpColorHex(0xffcc66, 0xff6644, t) };
    }
    if (hour < 20) {
        // 黄昏
        const t = (hour - 18.5) / 1.5;
        return { skyTop: lerpColor('#2a2040', '#0d0d28', t), skyHorizon: lerpColor('#ff4422', '#1a1a3a', t), fogColor: lerpColorHex(0x553322, 0x1a1a2e, t), ambientColor: lerpColorHex(0x3a2a2a, 0x1a1a2a, t), ambientIntensity: 0.6 - t * 0.2, sunColor: 0x8866aa };
    }
    // 夜晚
    return { skyTop: '#0a0a20', skyHorizon: '#0d0d28', fogColor: 0x0a0a20, ambientColor: 0x1a1a2e, ambientIntensity: 0.3, sunColor: 0x8888bb };
}

function lerpColor(c1, c2, t) {
    const r1 = parseInt(c1.slice(1,3), 16), g1 = parseInt(c1.slice(3,5), 16), b1 = parseInt(c1.slice(5,7), 16);
    const r2 = parseInt(c2.slice(1,3), 16), g2 = parseInt(c2.slice(3,5), 16), b2 = parseInt(c2.slice(5,7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function lerpColorHex(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
}

// ===== 天空球（Canvas 渐变纹理）=====
let skyCanvas, skyCtx, skyTexture;
function createSkyDome() {
    skyCanvas = document.createElement('canvas');
    skyCanvas.width = 256;
    skyCanvas.height = 128;
    skyCtx = skyCanvas.getContext('2d');

    skyTexture = new THREE.CanvasTexture(skyCanvas);
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    skyTexture.minFilter = THREE.LinearFilter;
    skyTexture.magFilter = THREE.LinearFilter;

    const skyGeo = new THREE.SphereGeometry(45, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true
    });
    skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.name = 'skyDome';
    skyDome.renderOrder = -1;
    scene.add(skyDome);
}

function updateSkyDome(hour) {
    const tc = getTimeColors(hour);
    const grad = skyCtx.createLinearGradient(0, 0, 0, skyCanvas.height);
    grad.addColorStop(0, tc.skyTop);
    grad.addColorStop(0.55, tc.skyHorizon);
    grad.addColorStop(1, tc.skyHorizon);
    skyCtx.fillStyle = grad;
    skyCtx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
    skyTexture.needsUpdate = true;
}

// ===== 粒子系统 =====
function createParticles() {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        // 散布在场地上方
        positions[i * 3] = (Math.random() - 0.5) * 14;
        positions[i * 3 + 1] = Math.random() * 6;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
        // 淡金色
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 0.7;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.06,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.6
    });

    particleSystem = new THREE.Points(geo, mat);
    particleSystem.name = 'particles';
    scene.add(particleSystem);
}

function updateParticles(hour) {
    if (!particleSystem) return;
    const altitude = calcSunAltitude(hour, CONFIG.seasons[state.season].noonAngle);
    // 白天粒子可见，晚上几乎不可见
    const opacity = altitude > 0 ? Math.min(1, altitude / 30) * 0.6 : 0.05;
    particleSystem.material.opacity = opacity;

    // 粒子缓慢漂动
    const positions = particleSystem.geometry.attributes.position.array;
    const t = performance.now() * 0.0002;
    for (let i = 0; i < positions.length / 3; i++) {
        const baseY = positions[i * 3 + 1];
        positions[i * 3] += Math.sin(t + i) * 0.001;
        positions[i * 3 + 1] = baseY + Math.sin(t * 1.3 + i) * 0.3;
        positions[i * 3 + 2] += Math.cos(t + i) * 0.001;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
}

// ===== 太阳轨迹线 =====
function createSunTrail() {
    const points = [];
    const seasonData = CONFIG.seasons[state.season];
    for (let h = 6; h <= 18; h += 0.5) {
        const alt = calcSunAltitude(h, seasonData.noonAngle);
        if (alt < 0) continue;
        const az = calcSunAzimuth(h);
        if (az === null) continue;
        const azRad = THREE.MathUtils.degToRad(az);
        const altRad = THREE.MathUtils.degToRad(alt);
        const dist = CONFIG.sunDist;
        points.push(new THREE.Vector3(
            Math.sin(azRad) * Math.cos(altRad) * dist,
            Math.sin(altRad) * dist,
            -Math.cos(azRad) * Math.cos(altRad) * dist
        ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
        color: 0xffcc66,
        transparent: true,
        opacity: 0.25,
        depthTest: true,
        depthWrite: false
    });
    sunTrailLine = new THREE.Line(geo, mat);
    sunTrailLine.name = 'sunTrail';
    scene.add(sunTrailLine);
}

function updateSunTrail() {
    if (sunTrailLine) {
        scene.remove(sunTrailLine);
        sunTrailLine.geometry.dispose();
    }
    createSunTrail();
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
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(Math.max(1, w), Math.max(1, h), false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 后处理管线 — 确保初始尺寸 > 0，避免零尺寸 framebuffer
    const safeW = Math.max(1, w);
    const safeH = Math.max(1, h);
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(safeW, safeH),
        1.2,   // strength
        0.4,   // radius
        0.85   // threshold — 只有太阳等亮像素会 bloom
    );
    composer.addPass(bloomPass);
    composer.setSize(safeW, safeH);

    // OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.78;
    controls.update();

    // 环境光
    const ambient = new THREE.AmbientLight(0x6688aa, 1.6);
    ambient.name = 'ambient';
    scene.add(ambient);

    // 太阳平行光
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

    // 太阳球体 + 光晕
    const sunGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    sunSphere = new THREE.Mesh(sunGeo, sunMat);
    sunSphere.name = 'sunSphere';
    scene.add(sunSphere);

    const glowGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
    });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    glowSphere.name = 'sunGlow';
    sunSphere.add(glowSphere);

    // 天空球
    createSkyDome();

    // 地面阴影接收面
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    floor.name = 'shadowFloor';
    scene.add(floor);

    // 遮挡阴影接收面的天空光
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3a5a2a, 0.6);
    hemiLight.name = 'hemiLight';
    scene.add(hemiLight);

    // 场景构建
    groundGroup = new THREE.Group();
    scene.add(groundGroup);
    buildGround();

    poleGroup = new THREE.Group();
    scene.add(poleGroup);
    buildPole();

    // 粒子
    createParticles();

    // 太阳轨迹
    createSunTrail();

    // 初始天空
    updateSkyDome(state.hour);
    updateBloomForTime(state.hour);
}

// ===== 纹理加载 =====
const texLoader = new THREE.TextureLoader();
texLoader.setPath('assets/textures/');

function loadTexture(path) {
    const tex = texLoader.load(path, undefined, undefined, () => {});
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

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
            const topMat = new THREE.MeshStandardMaterial({
                map: TEX.grassTop, roughness: 0.85, metalness: 0.0
            });
            const sideMat = new THREE.MeshStandardMaterial({
                map: TEX.grassSide, roughness: 0.9, metalness: 0.0
            });
            const bottomMat = new THREE.MeshStandardMaterial({
                map: TEX.dirt, roughness: 1.0, metalness: 0.0
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

    // 中央基底
    const baseGeo = new THREE.BoxGeometry(1.1, 0.06, 1.1);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, 0.23, 0);
    base.receiveShadow = true;
    base.name = 'baseMarker';
    groundGroup.add(base);
}

// ===== 标杆 =====
function buildPole() {
    poleGroup.clear();
    const h = CONFIG.poleHeight;
    const poleSize = 0.2;

    const redMat = new THREE.MeshStandardMaterial({
        map: TEX.pole, roughness: 0.4, metalness: 0.1
    });
    const whiteMat = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0, roughness: 0.5, metalness: 0.1
    });

    for (let i = 0; i < h; i++) {
        const mat = i % 2 === 0 ? redMat : whiteMat;
        const geo = new THREE.BoxGeometry(poleSize, 1.0, poleSize);
        const block = new THREE.Mesh(geo, [mat, mat, mat, mat, mat, mat]);
        block.position.set(0, 0.22 + i + 0.5, 0);
        block.castShadow = true;
        block.receiveShadow = true;
        block.name = `pole-${i}`;
        poleGroup.add(block);
    }

    const capGeo = new THREE.BoxGeometry(poleSize * 1.3, 0.25, poleSize * 1.3);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.3 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.22 + h + 0.63, 0);
    cap.castShadow = true;
    cap.receiveShadow = true;
    cap.name = 'poleCap';
    poleGroup.add(cap);
}

// ===== 太阳 + 环境更新 =====
function updateSunAndSky() {
    const seasonData = CONFIG.seasons[state.season];
    const altitude = calcSunAltitude(state.hour, seasonData.noonAngle);
    const azimuth = calcSunAzimuth(state.hour);

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

        const tc = getTimeColors(state.hour);
        sunLight.intensity = Math.max(0.08, altitude / 30) * 2.5;
        sunLight.color.set(tc.sunColor);

        // 太阳颜色随高度角变化 ← 低空偏橙，高空白
        const sunBaseColor = new THREE.Color(tc.sunColor);
        sunSphere.material.color.copy(sunBaseColor);
    } else {
        sunSphere.visible = false;
        sunLight.intensity = 0.06;
    }

    // 环境
    const tc = getTimeColors(state.hour);
    const ambient = scene.getObjectByName('ambient');
    if (ambient) {
        ambient.intensity = tc.ambientIntensity;
        ambient.color.set(tc.ambientColor);
    }

    const hemi = scene.getObjectByName('hemiLight');
    if (hemi) {
        hemi.intensity = altitude > 0 ? 0.6 : 0.15;
    }

    // 雾
    scene.fog = new THREE.Fog(tc.fogColor, 25, 70);

    // 天空球
    updateSkyDome(state.hour);
    updateBloomForTime(state.hour);
}

function updateBloomForTime(hour) {
    // 白天降低 bloom，日出日落增强
    if (hour >= 5 && hour <= 7) {
        bloomPass.strength = 1.8;
    } else if (hour >= 17 && hour <= 19) {
        bloomPass.strength = 1.8;
    } else if (hour >= 8 && hour <= 16) {
        bloomPass.strength = 1.0;
    } else {
        bloomPass.strength = 0.6;
    }
}

// ===== 渲染循环 =====
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateSunAndSky();
    updateParticles(state.hour);

    // 自动播放
    if (state.isPlaying) {
        const speed = state.playSpeed === 2 ? 0.15 : 0.05;
        state.hour += speed;
        if (state.hour >= 24) state.hour = 0;
        updateDataPanel();
        updateTimelineUI();
    }

    // 用 composer 替代直接 render
    composer.render();
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
    const seasonDesc = CONFIG.seasons[state.season].desc;
    document.getElementById('knowledgeContent').innerHTML =
        `<div style="display:flex;gap:10px;align-items:flex-start;">
            <div style="font-size:1.8rem;flex-shrink:0;">${state.season==='winter'?'❄️':state.season==='summer'?'☀️':'🍂'}</div>
            <div>
                <div style="font-weight:700;color:#F4D142;margin-bottom:4px;">${data.phase} · ${seasonName}</div>
                <div style="margin-bottom:6px;line-height:1.7;">${data.text}</div>
                <div style="font-size:0.82rem;color:#a09080;border-left:3px solid #5a4020;padding-left:10px;">${seasonDesc}</div>
            </div>
        </div>`;
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
        let rule = (h === 6 || h === 18) ? '日出/日落，最长' :
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

// ===== 时间轴 =====
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
    updateSunTrail();
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
}

function resetExperiment() {
    state.isPlaying = false;
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

// ===== 事件绑定 =====
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

    window.addEventListener('resize', () => {
        const container = document.getElementById('threeContainer');
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
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
