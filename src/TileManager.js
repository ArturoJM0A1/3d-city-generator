import * as THREE from 'three';
import { OSMService } from './OSMService.js';
import { BuildingGenerator } from './BuildingGenerator.js';
import { RoadGenerator } from './RoadGenerator.js';

export class TileManager {
    constructor(centerLat, centerLon, scene) {
        this.centerLat = centerLat;
        this.centerLon = centerLon;
        this.scene = scene;
        this.tiles = new Map();
        this.tileSize = 800;
        this.loadRadius = 2;
        this.unloadRadius = 3;
        this.groundMesh = null;
        this.currentCenterTile = { x: 0, z: 0 };
        
        this.buildingGenerator = new BuildingGenerator(centerLat, centerLon);
        this.roadGenerator = new RoadGenerator(centerLat, centerLon);
        
        this.buildingCount = 0;
        this.roadCount = 0;
        
        this.onStatsUpdate = null;
    }
    
    updatePosition(cameraX, cameraZ) {
        const tileX = Math.floor(cameraX / this.tileSize);
        const tileZ = Math.floor(cameraZ / this.tileSize);
        
        if (tileX === this.currentCenterTile.x && tileZ === this.currentCenterTile.z) {
            return;
        }
        
        this.currentCenterTile = { x: tileX, z: tileZ };
        this.loadNearbyTiles(tileX, tileZ);
        this.unloadDistantTiles(tileX, tileZ);
    }
    
    async loadNearbyTiles(centerX, centerZ) {
        const loadPromises = [];
        
        for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
            for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
                const tileKey = `${centerX + dx}:${centerZ + dz}`;
                
                if (!this.tiles.has(tileKey)) {
                    loadPromises.push(this.loadTile(centerX + dx, centerZ + dz));
                }
            }
        }
        
        await Promise.all(loadPromises);
    }
    
    unloadDistantTiles(centerX, centerZ) {
        const tilesToRemove = [];
        
        for (const [key, tile] of this.tiles.entries()) {
            const dx = tile.tileX - centerX;
            const dz = tile.tileZ - centerZ;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > this.unloadRadius) {
                tilesToRemove.push(key);
            }
        }
        
        for (const key of tilesToRemove) {
            this.removeTile(key);
        }
    }
    
    async loadTile(tileX, tileZ) {
        const tileKey = `${tileX}:${tileZ}`;
        
        const centerLat = this.centerLat + (tileZ * this.tileSize) / 111000;
        const centerLon = this.centerLon + (tileX * this.tileSize) / (111000 * Math.cos(this.centerLat * Math.PI / 180));
        
        try {
            const tileGroup = new THREE.Group();
            tileGroup.position.set(
                tileX * this.tileSize,
                0,
                tileZ * this.tileSize
            );
            
            const data = await OSMService.fetchAll(centerLat, centerLon, this.tileSize * 0.7);
            
            const { nodes, ways } = OSMService.parseOSMData(data);
            
            const buildings = ways.filter(w => OSMService.isBuildingWay(w));
            const roads = ways.filter(w => OSMService.isRoadWay(w));
            
            for (const way of buildings) {
                const building = this.buildingGenerator.generateBuilding(way, nodes);
                if (building) {
                    const mesh = this.buildingGenerator.createBuildingMesh(building);
                    if (mesh) {
                        tileGroup.add(mesh);
                        this.buildingCount++;
                    }
                }
            }
            
            for (const way of roads) {
                const road = this.roadGenerator.generateRoad(way, nodes);
                if (road) {
                    const mesh = this.roadGenerator.createRoadMesh(road);
                    if (mesh) {
                        tileGroup.add(mesh);
                        this.roadCount++;
                    }
                }
            }
            
            this.scene.add(tileGroup);
            
            this.tiles.set(tileKey, {
                tileX,
                tileZ,
                group: tileGroup,
                nodes,
                ways
            });
            
            this.updateStats();
            
        } catch (error) {
            console.error(`Error loading tile ${tileKey}:`, error);
        }
    }
    
    removeTile(tileKey) {
        const tile = this.tiles.get(tileKey);
        if (tile) {
            this.scene.remove(tile.group);
            
            tile.group.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            
            const buildingCount = tile.ways.filter(w => OSMService.isBuildingWay(w)).length;
            const roadCount = tile.ways.filter(w => OSMService.isRoadWay(w)).length;
            this.buildingCount -= buildingCount;
            this.roadCount -= roadCount;
            
            this.tiles.delete(tileKey);
            this.updateStats();
        }
    }
    
    createGround() {
        if (this.groundMesh) {
            this.scene.remove(this.groundMesh);
            this.groundMesh.geometry.dispose();
            this.groundMesh.material.dispose();
        }
        
        const groundGeometry = new THREE.PlaneGeometry(10000, 10000);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.9,
            metalness: 0.1
        });
        
        this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.y = 0;
        this.groundMesh.receiveShadow = true;
        this.groundMesh.userData = { type: 'ground' };
        
        this.scene.add(this.groundMesh);
        
        this.createGrid();
    }
    
    createGrid() {
        const gridSize = 10000;
        const gridDivisions = 100;
        
        const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x333355, 0x222244);
        gridHelper.position.y = 0.1;
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }
    
    updateStats() {
        if (this.onStatsUpdate) {
            this.onStatsUpdate({
                buildings: Math.max(0, this.buildingCount),
                roads: Math.max(0, this.roadCount),
                tiles: this.tiles.size
            });
        }
    }
    
    getTileCount() {
        return this.tiles.size;
    }
    
    dispose() {
        for (const key of this.tiles.keys()) {
            this.removeTile(key);
        }
        
        if (this.groundMesh) {
            this.scene.remove(this.groundMesh);
            this.groundMesh.geometry.dispose();
            this.groundMesh.material.dispose();
        }
    }
}
