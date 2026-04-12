import * as THREE from 'three';

export class InteractionManager {
    constructor(camera, renderer, scene) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.hoveredObject = null;
        this.selectedObject = null;
        
        this.buildings = [];
        this.groundPlane = null;
        
        this.onBuildingSelect = null;
        this.onBuildingHover = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
        this.renderer.domElement.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    }
    
    onMouseMove(event) {
        this.updateMousePosition(event);
        this.checkHover();
    }
    
    onClick(event) {
        if (event.shiftKey) return;
        
        this.updateMousePosition(event);
        this.checkSelection();
    }
    
    onDoubleClick(event) {
        this.updateMousePosition(event);
        this.checkDoubleClick();
    }
    
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    checkHover() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const buildingMeshes = this.getBuildingMeshes();
        const intersects = this.raycaster.intersectObjects(buildingMeshes, false);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            if (this.hoveredObject !== object) {
                if (this.hoveredObject) {
                    this.unhighlightObject(this.hoveredObject);
                }
                
                this.hoveredObject = object;
                this.highlightObject(object);
                
                if (this.onBuildingHover) {
                    this.onBuildingHover(object.userData.buildingData);
                }
            }
            
            this.renderer.domElement.style.cursor = 'pointer';
        } else {
            if (this.hoveredObject) {
                this.unhighlightObject(this.hoveredObject);
                this.hoveredObject = null;
            }
            
            this.renderer.domElement.style.cursor = 'default';
        }
    }
    
    checkSelection() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const buildingMeshes = this.getBuildingMeshes();
        const intersects = this.raycaster.intersectObjects(buildingMeshes, false);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            if (this.selectedObject) {
                this.deselectObject(this.selectedObject);
            }
            
            this.selectedObject = object;
            this.selectObject(object);
            
            if (this.onBuildingSelect) {
                this.onBuildingSelect(object.userData.buildingData);
            }
        } else {
            if (this.selectedObject) {
                this.deselectObject(this.selectedObject);
                this.selectedObject = null;
                
                if (this.onBuildingSelect) {
                    this.onBuildingSelect(null);
                }
            }
        }
    }
    
    checkDoubleClick() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const buildingMeshes = this.getBuildingMeshes();
        const intersects = this.raycaster.intersectObjects(buildingMeshes, false);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            const buildingData = object.userData.buildingData;
            
            if (buildingData) {
                this.animateToBuilding(object);
            }
        }
    }
    
    getBuildingMeshes() {
        const meshes = [];
        
        this.scene.traverse((object) => {
            if (object.userData?.type === 'building' && object.isMesh) {
                meshes.push(object);
            }
        });
        
        return meshes;
    }
    
    highlightObject(object) {
        if (object.material && !object.userData.originalEmissive) {
            object.userData.originalEmissive = object.material.emissive?.clone() || new THREE.Color(0x000000);
            object.userData.originalColor = object.material.color?.clone() || object.material.color;
            
            if (object.material.emissive) {
                object.material.emissive.setHex(0x667eea);
                object.material.emissiveIntensity = 0.3;
            }
        }
    }
    
    unhighlightObject(object) {
        if (object.material && object.userData.originalEmissive) {
            if (object.material.emissive) {
                object.material.emissive.copy(object.userData.originalEmissive);
                object.material.emissiveIntensity = 0;
            }
            
            if (object.userData.originalColor) {
                object.material.color.copy(object.userData.originalColor);
            }
            
            delete object.userData.originalEmissive;
            delete object.userData.originalColor;
        }
    }
    
    selectObject(object) {
        if (object.material) {
            object.userData.selectedColor = object.material.color?.clone() || object.material.color;
            
            if (object.material.emissive) {
                object.material.emissive.setHex(0x764ba2);
                object.material.emissiveIntensity = 0.5;
            }
        }
        
        this.createSelectionOutline(object);
    }
    
    deselectObject(object) {
        if (object.material) {
            if (object.material.emissive) {
                object.material.emissive.setHex(0x000000);
                object.material.emissiveIntensity = 0;
            }
        }
        
        this.removeSelectionOutline(object);
    }
    
    createSelectionOutline(object) {
        if (this.selectionOutline) {
            this.removeSelectionOutline(this.selectedObject);
        }
        
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        const outlineGeometry = new THREE.BoxGeometry(
            size.x + 1,
            size.y + 1,
            size.z + 1
        );
        
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x667eea,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.3
        });
        
        this.selectionOutline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        this.selectionOutline.position.copy(center);
        this.scene.add(this.selectionOutline);
        
        const edgesGeometry = new THREE.EdgesGeometry(outlineGeometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0x667eea,
            linewidth: 2
        });
        
        this.selectionEdges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        this.selectionEdges.position.copy(center);
        this.scene.add(this.selectionEdges);
    }
    
    removeSelectionOutline(object) {
        if (this.selectionOutline) {
            this.scene.remove(this.selectionOutline);
            this.selectionOutline.geometry.dispose();
            this.selectionOutline.material.dispose();
            this.selectionOutline = null;
        }
        
        if (this.selectionEdges) {
            this.scene.remove(this.selectionEdges);
            this.selectionEdges.geometry.dispose();
            this.selectionEdges.material.dispose();
            this.selectionEdges = null;
        }
    }
    
    animateToBuilding(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 3;
        
        const camera = this.camera;
        const targetPosition = new THREE.Vector3(
            center.x + distance,
            center.y + distance * 0.5,
            center.z + distance
        );
        
        const startPosition = camera.position.clone();
        const startTarget = camera.userData.target || new THREE.Vector3();
        
        let progress = 0;
        const duration = 1000;
        const startTime = performance.now();
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            progress = Math.min(elapsed / duration, 1);
            
            const eased = this.easeOutCubic(progress);
            
            camera.position.lerpVectors(startPosition, targetPosition, eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    flyToPosition(lat, lon, tileManager) {
        const center = tileManager.centerLat;
        const centerLon = tileManager.centerLon;
        
        const x = (lon - centerLon) * 111000 * Math.cos(center * Math.PI / 180);
        const z = (lat - center) * 111000;
        
        const camera = this.camera;
        const targetPosition = new THREE.Vector3(x, 300, z + 400);
        
        const startPosition = camera.position.clone();
        let progress = 0;
        const duration = 2000;
        const startTime = performance.now();
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            progress = Math.min(elapsed / duration, 1);
            
            const eased = this.easeInOutCubic(progress);
            
            camera.position.lerpVectors(startPosition, targetPosition, eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    dispose() {
        this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
        this.renderer.domElement.removeEventListener('click', this.onClick);
        this.renderer.domElement.removeEventListener('dblclick', this.onDoubleClick);
        
        if (this.selectionOutline) {
            this.selectionOutline.geometry.dispose();
            this.selectionOutline.material.dispose();
        }
        
        if (this.selectionEdges) {
            this.selectionEdges.geometry.dispose();
            this.selectionEdges.material.dispose();
        }
    }
}
