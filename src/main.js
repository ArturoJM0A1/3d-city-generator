import { SceneManager } from './SceneManager.js';
import { TileManager } from './TileManager.js';
import { InteractionManager } from './InteractionManager.js';
import { GeoUtils } from './GeoUtils.js';

class CityGenerator {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.loadingOverlay = document.getElementById('loading-overlay');
        
        this.defaultLat = 40.7128;
        this.defaultLon = -74.0060;
        
        this.centerLat = this.defaultLat;
        this.centerLon = this.defaultLon;
        
        this.sceneManager = null;
        this.tileManager = null;
        this.interactionManager = null;
        
        this.isInitialized = false;
        
        this.init();
    }
    
    async init() {
        try {
            this.sceneManager = new SceneManager(this.container);
            this.tileManager = new TileManager(this.centerLat, this.centerLon, this.sceneManager.scene);
            this.interactionManager = new InteractionManager(
                this.sceneManager.camera,
                this.sceneManager.renderer,
                this.sceneManager.scene
            );
            
            this.setupEventListeners();
            this.setupUI();
            
            this.tileManager.createGround();
            
            setTimeout(() => {
                if (!this.isInitialized) {
                    console.log('Forzando inicio después de timeout...');
                    this.hideLoading();
                }
            }, 20000);
            
            await this.loadInitialArea();
            
            this.isInitialized = true;
            this.hideLoading();
            
        } catch (error) {
            console.error('Error inicializando:', error);
            this.hideLoading();
        }
        
        this.animate();
    }
    
    setupEventListeners() {
        this.tileManager.onStatsUpdate = (stats) => {
            this.updateStatsUI(stats);
        };
        
        this.interactionManager.onBuildingSelect = (buildingData) => {
            this.updateBuildingInfo(buildingData);
        };
        
        this.interactionManager.onBuildingHover = (buildingData) => {
            this.updateHoverInfo(buildingData);
        };
    }
    
    setupUI() {
        const searchBtn = document.getElementById('search-btn');
        const locationInput = document.getElementById('location-input');
        
        searchBtn.addEventListener('click', () => {
            const value = locationInput.value.trim();
            if (value) {
                this.handleLocationSearch(value);
            }
        });
        
        locationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = locationInput.value.trim();
                if (value) {
                    this.handleLocationSearch(value);
                }
            }
        });
        
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lat = parseFloat(btn.dataset.lat);
                const lon = parseFloat(btn.dataset.lon);
                this.moveToLocation(lat, lon);
            });
        });
    }
    
    handleLocationSearch(value) {
        const parts = value.split(',').map(p => parseFloat(p.trim()));
        
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const [lat, lon] = parts;
            
            if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                this.moveToLocation(lat, lon);
                return;
            }
        }
        
        this.geocodeLocation(value);
    }
    
    async geocodeLocation(query) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
            );
            
            if (!response.ok) throw new Error('Geocoding failed');
            
            const results = await response.json();
            
            if (results.length > 0) {
                const { lat, lon } = results[0];
                this.moveToLocation(parseFloat(lat), parseFloat(lon));
            } else {
                alert('Ubicación no encontrada. Intenta con coordenadas (lat, lon).');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            alert('Error al buscar la ubicación. Intenta con coordenadas.');
        }
    }
    
    async moveToLocation(lat, lon) {
        this.showLoading('Cambiando ubicación...');
        
        this.centerLat = lat;
        this.centerLon = lon;
        
        this.tileManager.dispose();
        this.tileManager = new TileManager(lat, lon, this.sceneManager.scene);
        this.tileManager.createGround();
        
        this.tileManager.onStatsUpdate = (stats) => {
            this.updateStatsUI(stats);
        };
        
        this.interactionManager.flyToPosition(lat, lon, this.tileManager);
        
        await this.loadInitialArea();
        
        this.hideLoading();
    }
    
    async loadInitialArea() {
        const initialTiles = 2;
        const tiles = [];
        
        for (let dx = -initialTiles; dx <= initialTiles; dx++) {
            for (let dz = -initialTiles; dz <= initialTiles; dz++) {
                tiles.push(this.tileManager.loadTile(dx, dz));
            }
        }
        
        const timeoutPromise = new Promise(resolve => {
            setTimeout(() => {
                console.log('Timeout alcanzado, mostrando ciudad demo...');
                resolve('timeout');
            }, 15000);
        });
        
        await Promise.race([
            Promise.allSettled(tiles),
            timeoutPromise
        ]);
        
        this.tileManager.currentCenterTile = { x: 0, z: 0 };
        this.hideLoading();
    }
    
    updateStatsUI(stats) {
        const buildingCountEl = document.getElementById('building-count');
        const roadCountEl = document.getElementById('road-count');
        const tileCountEl = document.getElementById('tile-count');
        const fpsEl = document.getElementById('fps-display');
        
        if (buildingCountEl) buildingCountEl.textContent = stats.buildings.toLocaleString();
        if (roadCountEl) roadCountEl.textContent = stats.roads.toLocaleString();
        if (tileCountEl) tileCountEl.textContent = stats.tiles;
        if (fpsEl) fpsEl.textContent = this.sceneManager.getFPS();
    }
    
    updateBuildingInfo(buildingData) {
        const infoPanel = document.getElementById('info-panel');
        
        if (!buildingData) {
            infoPanel.classList.remove('visible');
            return;
        }
        
        infoPanel.classList.add('visible');
        
        document.getElementById('info-levels').textContent = buildingData.levels || '-';
        document.getElementById('info-height').textContent = buildingData.height?.toFixed(1) || '-';
        document.getElementById('info-type').textContent = buildingData.type || '-';
        document.getElementById('info-name').textContent = buildingData.name || 'Sin nombre';
    }
    
    updateHoverInfo(buildingData) {
    }
    
    showLoading(message = 'Cargando...') {
        const loadingText = this.loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        this.loadingOverlay.classList.remove('hidden');
    }
    
    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.sceneManager.render();
        
        if (this.tileManager) {
            const camPos = this.sceneManager.camera.position;
            this.tileManager.updatePosition(camPos.x, camPos.z);
        }
        
        if (this.selectionOutline) {
            if (this.selectionOutline.parent === this.sceneManager.scene) {
                const building = this.interactionManager.selectedObject;
                if (building) {
                    const box = new THREE.Box3().setFromObject(building);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    
                    this.selectionOutline.position.copy(center);
                    this.selectionOutline.scale.set(
                        size.x + 1,
                        size.y + 1,
                        size.z + 1
                    );
                    
                    if (this.selectionEdges) {
                        this.selectionEdges.position.copy(center);
                    }
                }
            }
        }
        
        const fpsEl = document.getElementById('fps-display');
        if (fpsEl) {
            fpsEl.textContent = this.sceneManager.getFPS();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cityGenerator = new CityGenerator();
});
