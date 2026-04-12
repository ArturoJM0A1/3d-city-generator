import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.isDarkTheme = true;
        
        this.themes = {
            dark: {
                background: 0x1a1a2e,
                fog: 0x1a1a2e,
                fogDensity: 0.0008,
                ambient: 0x404050,
                ambientIntensity: 0.4,
                hemisphere: 0x87ceeb,
                hemisphereGround: 0x3d3d3d,
                hemisphereIntensity: 0.5,
                sun: 0xfff5e6,
                sunIntensity: 1.5,
                sunPosition: { x: 200, y: 400, z: 150 },
                fill: 0x8899aa,
                fillIntensity: 0.3,
                fillPosition: { x: -100, y: 100, z: -100 },
                exposure: 1.2,
                ground: 0x333333,
                groundRoughness: 0.9,
                bloomStrength: 0.3
            },
            light: {
                background: 0xb8d4e8,
                fog: 0xc8dde8,
                fogDensity: 0.0004,
                ambient: 0xffffff,
                ambientIntensity: 0.8,
                hemisphere: 0x87ceeb,
                hemisphereGround: 0xbbbbbb,
                hemisphereIntensity: 0.6,
                sun: 0xfffaf0,
                sunIntensity: 2.0,
                sunPosition: { x: 300, y: 500, z: 200 },
                fill: 0xaaccff,
                fillIntensity: 0.5,
                fillPosition: { x: -200, y: 200, z: -100 },
                exposure: 1.0,
                ground: 0xcccccc,
                groundRoughness: 0.95,
                bloomStrength: 0.15
            }
        };
        
        this.init();
    }
    
    init() {
        this.setupRenderer();
        this.setupCamera();
        this.setupControls();
        this.setupLights();
        this.setupEnvironment();
        this.setupPostProcessing();
        this.setupResize();
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        this.container.appendChild(this.renderer.domElement);
        
        this.tryWebGPU();
    }
    
    async tryWebGPU() {
        if ('gpu' in navigator) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    console.log('WebGPU disponible - Rendering acelerado por GPU');
                }
            } catch (e) {
                console.log('WebGPU no disponible, usando WebGL2');
            }
        }
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            1,
            50000
        );
        this.camera.position.set(500, 400, 500);
        this.camera.lookAt(0, 0, 0);
    }
    
    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 5000;
        this.controls.enablePan = true;
        this.controls.panSpeed = 1.5;
        this.controls.rotateSpeed = 0.8;
        this.controls.zoomSpeed = 1.2;
    }
    
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404050, 0.4);
        this.scene.add(ambientLight);
        
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3d3d3d, 0.5);
        this.scene.add(hemisphereLight);
        
        this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
        this.sunLight.position.set(200, 400, 150);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 1500;
        this.sunLight.shadow.camera.left = -800;
        this.sunLight.shadow.camera.right = 800;
        this.sunLight.shadow.camera.top = 800;
        this.sunLight.shadow.camera.bottom = -800;
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.shadow.normalBias = 0.02;
        this.scene.add(this.sunLight);
        
        this.fillLight = new THREE.DirectionalLight(0x8899aa, 0.3);
        this.fillLight.position.set(-100, 100, -100);
        this.scene.add(this.fillLight);
    }
    
    setupEnvironment() {
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        const fogColor = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.0008);
    }
    
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3,
            0.4,
            0.85
        );
        this.composer.addPass(this.bloomPass);
        
        const smaaPass = new SMAAPass(
            window.innerWidth * this.renderer.getPixelRatio(),
            window.innerHeight * this.renderer.getPixelRatio()
        );
        this.composer.addPass(smaaPass);
    }
    
    setupResize() {
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            
            this.renderer.setSize(width, height);
            this.composer.setSize(width, height);
        });
    }
    
    updateSunPosition(timeOfDay = 10) {
        const angle = (timeOfDay / 24) * Math.PI * 2 - Math.PI / 2;
        const radius = 600;
        
        this.sunLight.position.x = Math.cos(angle) * radius;
        this.sunLight.position.y = Math.sin(angle) * radius * 0.7 + 200;
        this.sunLight.position.z = Math.sin(angle * 0.5) * radius * 0.3;
    }
    
    setTheme(isDark) {
        this.isDarkTheme = isDark;
        const theme = isDark ? this.themes.dark : this.themes.light;
        
        this.scene.background = new THREE.Color(theme.background);
        this.scene.fog = new THREE.FogExp2(new THREE.Color(theme.fog), theme.fogDensity);
        
        this.scene.children.forEach(child => {
            if (child instanceof THREE.AmbientLight) {
                child.color.setHex(theme.ambient);
                child.intensity = theme.ambientIntensity;
            }
            if (child instanceof THREE.HemisphereLight) {
                child.color.setHex(theme.hemisphere);
                child.groundColor.setHex(theme.hemisphereGround);
                child.intensity = theme.hemisphereIntensity;
            }
            if (child instanceof THREE.DirectionalLight && child !== this.fillLight) {
                child.color.setHex(theme.sun);
                child.intensity = theme.sunIntensity;
                child.position.set(theme.sunPosition.x, theme.sunPosition.y, theme.sunPosition.z);
            }
            if (child === this.fillLight) {
                child.color.setHex(theme.fill);
                child.intensity = theme.fillIntensity;
                child.position.set(theme.fillPosition.x, theme.fillPosition.y, theme.fillPosition.z);
            }
        });
        
        this.renderer.toneMappingExposure = theme.exposure;
        
        this.scene.traverse(child => {
            if (child.userData?.type === 'ground' && child.material) {
                child.material.color.setHex(theme.ground);
                child.material.roughness = theme.groundRoughness;
            }
        });
        
        if (this.bloomPass) {
            this.bloomPass.strength = theme.bloomStrength;
        }
        
        this.updateBuildingMaterials();
    }
    
    updateBuildingMaterials() {
        const isDark = this.isDarkTheme;
        
        this.scene.traverse(child => {
            if (child.userData?.type === 'building' && child.material) {
                const baseColor = child.userData.buildingData?.color;
                
                if (baseColor) {
                    const color = new THREE.Color(baseColor);
                    
                    if (isDark) {
                        color.multiplyScalar(0.7);
                    } else {
                        color.multiplyScalar(1.3);
                        color.clampScalar(0, 1);
                    }
                    
                    child.material.color.copy(color);
                }
            }
            
            if (child.userData?.type === 'road' && child.material) {
                if (isDark) {
                    child.material.color.multiplyScalar(0.8);
                } else {
                    child.material.color.setHex(0x555555);
                }
            }
        });
    }
    
    render() {
        this.controls.update();
        
        const delta = this.clock.getDelta();
        
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate > 500) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
        
        this.composer.render();
    }
    
    getFPS() {
        return this.fps;
    }
}
