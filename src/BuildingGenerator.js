import * as THREE from 'three';
import { GeoUtils } from './GeoUtils.js';
import { OSMService } from './OSMService.js';

export class BuildingGenerator {
    constructor(centerLat, centerLon) {
        this.centerLat = centerLat;
        this.centerLon = centerLon;
        this.materials = this.createMaterials();
        this.buildingCount = 0;
    }
    
    createMaterials() {
        const materials = {
            buildings: new Map(),
            default: new THREE.MeshStandardMaterial({
                color: 0x8899aa,
                roughness: 0.7,
                metalness: 0.1,
                flatShading: false
            })
        };
        
        const buildingTypes = [
            'apartments', 'house', 'office', 'commercial', 
            'retail', 'industrial', 'warehouse', 'hotel'
        ];
        
        buildingTypes.forEach(type => {
            const baseColor = OSMService.getBuildingColor({ tags: { building: type } });
            materials.buildings.set(type, new THREE.MeshStandardMaterial({
                color: baseColor,
                roughness: 0.6 + Math.random() * 0.3,
                metalness: 0.05,
                flatShading: false
            }));
        });
        
        return materials;
    }
    
    getMaterial(way) {
        if (!way.tags || !way.tags.building) {
            return this.materials.default;
        }
        
        const type = way.tags.building;
        
        if (this.materials.buildings.has(type)) {
            return this.materials.buildings.get(type);
        }
        
        const color = OSMService.getBuildingColor(way);
        return new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.65,
            metalness: 0.1
        });
    }
    
    generateBuilding(way, nodes, instanceMesh = null) {
        const coords = this.getFootprintCoords(way, nodes);
        
        if (coords.length < 3) return null;
        
        const height = OSMService.getBuildingHeight(way) || 10;
        const baseColor = OSMService.getBuildingColor(way);
        
        return {
            wayId: way.id,
            coords: coords,
            height: height,
            color: baseColor,
            levels: Math.round(height / 3.5),
            type: way.tags?.building || 'yes',
            name: way.tags?.name || null,
            tags: way.tags || {}
        };
    }
    
    getFootprintCoords(way, nodes) {
        const coords = [];
        
        for (const nodeId of way.nodes) {
            const node = nodes.get(nodeId);
            if (node) {
                const pos = GeoUtils.latLonToCartesian(
                    node.lat, node.lon,
                    this.centerLat, this.centerLon
                );
                coords.push(new THREE.Vector2(pos.x, pos.z));
            }
        }
        
        return this.simplifyPolygon(coords);
    }
    
    simplifyPolygon(vertices, tolerance = 0.5) {
        if (vertices.length <= 3) return vertices;
        
        const simplified = [vertices[0]];
        
        for (let i = 1; i < vertices.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const curr = vertices[i];
            const next = vertices[i + 1];
            
            const area = Math.abs(
                (next.x - prev.x) * (curr.y - prev.y) -
                (curr.x - prev.x) * (next.y - prev.y)
            ) / 2;
            
            const dist = area * 2 / Math.sqrt(
                Math.pow(next.x - prev.x, 2) + Math.pow(next.y - prev.y, 2)
            );
            
            if (dist > tolerance) {
                simplified.push(curr);
            }
        }
        
        simplified.push(vertices[vertices.length - 1]);
        
        return simplified;
    }
    
    createShape(coords) {
        const shape = new THREE.Shape();
        
        if (coords.length === 0) return shape;
        
        shape.moveTo(coords[0].x, coords[0].y);
        
        for (let i = 1; i < coords.length; i++) {
            shape.lineTo(coords[i].x, coords[i].y);
        }
        
        shape.closePath();
        
        return shape;
    }
    
    createExtrudedGeometry(coords, height) {
        const shape = this.createShape(coords);
        
        if (shape.getLength() === 0) return null;
        
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.15,
            bevelSegments: 2,
            curveSegments: 8
        });
        
        geometry.rotateX(-Math.PI / 2);
        
        geometry.computeVertexNormals();
        
        return geometry;
    }
    
    createBuildingMesh(building) {
        const geometry = this.createExtrudedGeometry(building.coords, building.height);
        
        if (!geometry) return null;
        
        const color = building.color;
        const roughness = 0.5 + Math.random() * 0.4;
        const metalness = building.type === 'industrial' ? 0.3 : 0.1;
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: roughness,
            metalness: metalness,
            flatShading: false
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
            type: 'building',
            buildingData: building
        };
        
        return mesh;
    }
    
    createInstancedMesh(buildings) {
        if (buildings.length === 0) return null;
        
        const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8899aa,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const instancedMesh = new THREE.InstancedMesh(
            baseGeometry,
            material,
            buildings.length * 6
        );
        
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        
        let instanceIndex = 0;
        const dummy = new THREE.Object3D();
        const colors = new Float32Array(buildings.length * 6 * 3);
        
        for (const building of buildings) {
            if (building.coords.length < 3) continue;
            
            const bounds = this.getBounds2D(building.coords);
            const centerX = (bounds.minX + bounds.maxX) / 2;
            const centerZ = (bounds.minZ + bounds.maxZ) / 2;
            const width = bounds.maxX - bounds.minX;
            const depth = bounds.maxZ - bounds.minZ;
            
            for (let i = 0; i < 6; i++) {
                const instanceMatrix = new THREE.Matrix4();
                
                switch (i) {
                    case 0:
                        dummy.position.set(centerX, building.height / 2, centerZ);
                        dummy.scale.set(width, building.height, depth);
                        break;
                    case 1:
                        dummy.position.set(centerX, building.height, centerZ);
                        dummy.scale.set(width + 1, 0.5, depth + 1);
                        break;
                }
                
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(instanceIndex, dummy.matrix);
                
                const color = new THREE.Color(building.color);
                const offset = instanceIndex * 3;
                colors[offset] = color.r;
                colors[offset + 1] = color.g;
                colors[offset + 2] = color.b;
                
                instanceIndex++;
            }
        }
        
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.count = instanceIndex;
        
        return instancedMesh;
    }
    
    getBounds2D(coords) {
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        for (const coord of coords) {
            minX = Math.min(minX, coord.x);
            maxX = Math.max(maxX, coord.x);
            minZ = Math.min(minZ, coord.y);
            maxZ = Math.max(maxZ, coord.y);
        }
        
        return { minX, maxX, minZ, maxZ };
    }
    
    createMergedGeometry(buildings) {
        const geometries = [];
        
        for (const building of buildings) {
            const geometry = this.createExtrudedGeometry(building.coords, building.height);
            if (geometry) {
                geometries.push(geometry);
            }
        }
        
        if (geometries.length === 0) return null;
        if (geometries.length === 1) return geometries[0];
        
        const mergedGeometry = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];
        const indices = [];
        let indexOffset = 0;
        
        for (const geo of geometries) {
            const pos = geo.getAttribute('position');
            const norm = geo.getAttribute('normal');
            const idx = geo.getIndex();
            
            for (let i = 0; i < pos.count; i++) {
                positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                if (norm) {
                    normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
                }
            }
            
            if (idx) {
                for (let i = 0; i < idx.count; i++) {
                    indices.push(idx.getX(i) + indexOffset);
                }
            }
            
            indexOffset += pos.count;
        }
        
        mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        if (normals.length > 0) {
            mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        }
        mergedGeometry.setIndex(indices);
        
        return mergedGeometry;
    }
}
