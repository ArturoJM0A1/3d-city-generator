import * as THREE from 'three';
import { GeoUtils } from './GeoUtils.js';
import { OSMService } from './OSMService.js';

export class RoadGenerator {
    constructor(centerLat, centerLon) {
        this.centerLat = centerLat;
        this.centerLon = centerLon;
        this.roadGeometries = new Map();
        this.roadCount = 0;
    }
    
    createRoadMaterial(way) {
        const color = OSMService.getRoadColor(way);
        const isRailway = way.tags?.railway === 'rail';
        
        return new THREE.MeshStandardMaterial({
            color: color,
            roughness: isRailway ? 0.9 : 0.8,
            metalness: isRailway ? 0.2 : 0.0,
            flatShading: false
        });
    }
    
    generateRoad(way, nodes) {
        const coords = this.getRoadCoords(way, nodes);
        
        if (coords.length < 2) return null;
        
        const width = OSMService.getRoadWidth(way);
        const isRailway = way.tags?.railway === 'rail';
        
        return {
            wayId: way.id,
            coords: coords,
            width: width,
            isRailway: isRailway,
            type: way.tags?.highway || way.tags?.railway || 'unknown',
            tags: way.tags || {}
        };
    }
    
    getRoadCoords(way, nodes) {
        const coords = [];
        
        for (const nodeId of way.nodes) {
            const node = nodes.get(nodeId);
            if (node) {
                const pos = GeoUtils.latLonToCartesian(
                    node.lat, node.lon,
                    this.centerLat, this.centerLon
                );
                coords.push(new THREE.Vector3(pos.x, 0.05, pos.z));
            }
        }
        
        return coords;
    }
    
    createRoadMesh(road) {
        const group = new THREE.Group();
        
        if (road.isRailway) {
            return this.createRailwayMesh(road);
        }
        
        const curve = new THREE.CatmullRomCurve3(road.coords);
        const points = curve.getPoints(road.coords.length * 4);
        
        const shape = new THREE.Shape();
        const halfWidth = road.width / 2;
        shape.moveTo(-halfWidth, 0);
        shape.lineTo(halfWidth, 0);
        shape.lineTo(halfWidth, 0.1);
        shape.lineTo(-halfWidth, 0.1);
        shape.closePath();
        
        const geometry = new THREE.ExtrudeGeometry(shape, {
            steps: points.length - 1,
            bevelEnabled: false,
            extrudePath: curve
        });
        
        const material = this.createRoadMaterial({ tags: road.tags });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.userData = { type: 'road', roadData: road };
        
        group.add(mesh);
        
        if (road.tags?.name) {
            this.addRoadLabel(group, road);
        }
        
        return group;
    }
    
    createRailwayMesh(road) {
        const group = new THREE.Group();
        
        const curve = new THREE.CatmullRomCurve3(road.coords);
        const points = curve.getPoints(road.coords.length * 4);
        
        const railGeometry = new THREE.TubeGeometry(curve, points.length * 2, 0.3, 8, false);
        const railMaterial = new THREE.MeshStandardMaterial({
            color: 0x553333,
            roughness: 0.6,
            metalness: 0.4
        });
        
        const leftRail = new THREE.Mesh(railGeometry, railMaterial);
        leftRail.position.x = -0.75;
        leftRail.castShadow = true;
        
        const rightRail = new THREE.Mesh(railGeometry, railMaterial.clone());
        rightRail.position.x = 0.75;
        rightRail.castShadow = true;
        
        group.add(leftRail);
        group.add(rightRail);
        
        const sleeperGeometry = new THREE.BoxGeometry(3, 0.2, 0.4);
        const sleeperMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d2817,
            roughness: 0.9
        });
        
        const sleeperCount = Math.floor(road.coords.length * 4);
        for (let i = 0; i < sleeperCount; i++) {
            const t = i / sleeperCount;
            const point = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            
            const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
            sleeper.position.copy(point);
            sleeper.position.y = 0;
            sleeper.lookAt(point.clone().add(tangent));
            sleeper.castShadow = true;
            
            group.add(sleeper);
        }
        
        return group;
    }
    
    addRoadLabel(group, road) {
        const centerIndex = Math.floor(road.coords.length / 2);
        const centerPoint = road.coords[centerIndex];
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.roundRect(0, 0, canvas.width, canvas.height, 10);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(road.tags.name, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(centerPoint);
        sprite.position.y = 15;
        sprite.scale.set(40, 10, 1);
        
        group.add(sprite);
    }
    
    createMergedRoads(roads) {
        if (roads.length === 0) return null;
        
        const allVertices = [];
        const allIndices = [];
        const allNormals = [];
        const allUvs = [];
        
        let vertexOffset = 0;
        
        for (const road of roads) {
            if (road.coords.length < 2) continue;
            
            const halfWidth = road.width / 2;
            
            for (let i = 0; i < road.coords.length - 1; i++) {
                const current = road.coords[i];
                const next = road.coords[i + 1];
                
                const dx = next.x - current.x;
                const dz = next.z - current.z;
                const len = Math.sqrt(dx * dx + dz * dz);
                
                const nx = -dz / len * halfWidth;
                const nz = dx / len * halfWidth;
                
                const baseIndex = vertexOffset;
                
                allVertices.push(
                    current.x + nx, 0.1, current.z + nz,
                    current.x - nx, 0.1, current.z - nz,
                    next.x + nx, 0.1, next.z + nz,
                    next.x - nx, 0.1, next.z - nz
                );
                
                allNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
                
                const u = i / road.coords.length;
                const u2 = (i + 1) / road.coords.length;
                allUvs.push(0, u, 1, u, 0, u2, 1, u2);
                
                allIndices.push(
                    baseIndex, baseIndex + 1, baseIndex + 2,
                    baseIndex + 1, baseIndex + 3, baseIndex + 2
                );
                
                vertexOffset += 4;
            }
        }
        
        if (vertexOffset === 0) return null;
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(allUvs, 2));
        geometry.setIndex(allIndices);
        
        return geometry;
    }
}
