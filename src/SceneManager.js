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
        
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false
        };
        
        this.moveSpeed = 500;
        this.cameraHeight = 200;
        
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
        this.controls.enablePan = false;
        this.controls.rotateSpeed = 0.8;
        this.controls.zoomSpeed = 1.2;
        
        this.setupKeyboardControls();
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }
    
    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'PageUp':
                this.keys.forward = true;
                event.preventDefault();
                break;
            case 'ArrowDown':
            case 'ArrowLeft':
                this.keys.backward = true;
                event.preventDefault();
                break;
            case 'ArrowLeft':
                this.keys.left = true;
                event.preventDefault();
                break;
            case 'ArrowRight':
                this.keys.right = true;
                event.preventDefault();
                break;
            case 'Home':
                this.keys.up = true;
                event.preventDefault();
                break;
            case 'End':
                this.keys.down = true;
                event.preventDefault();
                break;
        }
    }
    
    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'PageUp':
                this.keys.forward = false;
                break;
            case 'ArrowDown':
                this.keys.backward = false;
                break;
            case 'ArrowLeft':
                this.keys.left = false;
                break;
            case 'ArrowRight':
                this.keys.right = false;
                break;
            case 'Home':
                this.keys.up = false;
                break;
            case 'End':
                this.keys.down = false;
                break;
        }
    }
    
    updateMovement(delta) {
        const speed = this.moveSpeed * delta;
        const direction = new THREE.Vector3();
        
        this.camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        
        if (this.keys.forward) {
            this.camera.position.addScaledVector(direction, speed);
        }
        if (this.keys.backward) {
            this.camera.position.addScaledVector(direction, -speed);
        }
        
        const right = new THREE.Vector3();
        right.crossVectors(direction, new THREE.Vector3(0, 1, 0));
        
        if (this.keys.left) {
            this.camera.position.addScaledVector(right, -speed);
        }
        if (this.keys.right) {
            this.camera.position.addScaledVector(right, speed);
        }
        
        if (this.keys.up) {
            this.camera.position.y += speed;
        }
        if (this.keys.down) {
            this.camera.position.y = Math.max(50, this.camera.position.y - speed);
        }
        
        this.camera.position.y = Math.max(50, Math.min(2000, this.camera.position.y));
    }
    
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0xbbbbbb, 0.6);
        this.scene.add(hemisphereLight);
        
        this.sunLight = new THREE.DirectionalLight(0xfffaf0, 2.0);
        this.sunLight.position.set(300, 500, 200);
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
        
        this.fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
        this.fillLight.position.set(-200, 200, -100);
        this.scene.add(this.fillLight);
    }
    
    setupEnvironment() {
        this.scene.background = new THREE.Color(0xb8d4e8);
        
        const fogColor = new THREE.Color(0xc8dde8);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.0004);
        this.renderer.toneMappingExposure = 1.0;
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
    
    render() {
        this.controls.update();
        
        const delta = this.clock.getDelta();
        this.updateMovement(delta);
        
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
