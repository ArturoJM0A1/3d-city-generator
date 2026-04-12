import { GeoUtils } from './GeoUtils.js';

export class OSMService {
    static OVERPASS_SERVERS = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
        'https://overpass.openstreetmap.ru/api/interpreter'
    ];
    
    static cache = new Map();
    static cacheTimeout = 5 * 60 * 1000;
    
    static async fetchBuildings(lat, lon, radius = 500) {
        const query = this.buildBuildingQuery(lat, lon, radius);
        return this.executeQuery(query);
    }
    
    static async fetchRoads(lat, lon, radius = 500) {
        const query = this.buildRoadsQuery(lat, lon, radius);
        return this.executeQuery(query);
    }
    
    static async fetchAll(lat, lon, radius = 500) {
        const query = this.buildCombinedQuery(lat, lon, radius);
        return this.executeQuery(query);
    }
    
    static buildBuildingQuery(lat, lon, radius) {
        return `
            [out:json][timeout:60];
            (
                way["building"](around:${radius},${lat},${lon});
                relation["building"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `.trim();
    }
    
    static buildRoadsQuery(lat, lon, radius) {
        return `
            [out:json][timeout:60];
            (
                way["highway"]["highway"!~"footway|path|cycleway|steps"](around:${radius},${lat},${lon});
                way["railway"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `.trim();
    }
    
    static buildCombinedQuery(lat, lon, radius) {
        return `
            [out:json][timeout:120];
            (
                way["building"](around:${radius},${lat},${lon});
                way["highway"]["highway"!~"footway|path|cycleway|steps"](around:${radius},${lat},${lon});
                way["railway"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `.trim();
    }
    
    static getCacheKey(lat, lon, radius) {
        const roundedLat = Math.round(lat * 1000) / 1000;
        const roundedLon = Math.round(lon * 1000) / 1000;
        return `${roundedLat},${roundedLon},${radius}`;
    }
    
    static async executeQuery(query, retries = 4) {
        const cacheKey = query;
        
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log('Usando datos en cache');
            return cached.data;
        }
        
        const shuffledServers = [...this.OVERPASS_SERVERS].sort(() => Math.random() - 0.5);
        
        let allFailed = true;
        
        for (const server of shuffledServers) {
            for (let retry = 0; retry < retries; retry++) {
                try {
                    console.log(`Consultando ${server} (intento ${retry + 1}/${retries})...`);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 45000);
                    
                    const response = await fetch(server, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: `data=${encodeURIComponent(query)}`,
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.status === 429) {
                        console.warn(`Rate limit en ${server}`);
                        await this.delay(2000);
                        continue;
                    }
                    
                    if (!response.ok) {
                        console.warn(`HTTP ${response.status} desde ${server}`);
                        await this.delay(1000);
                        continue;
                    }
                    
                    const data = await response.json();
                    
                    if (!data.elements || data.elements.length === 0) {
                        console.warn('No se encontraron datos para esta ubicación');
                    }
                    
                    this.cache.set(cacheKey, { data, timestamp: Date.now() });
                    allFailed = false;
                    return data;
                    
                } catch (error) {
                    const errorMsg = error.name === 'AbortError' ? 'Timeout' : error.message;
                    console.warn(`Error con ${server}: ${errorMsg}`);
                    await this.delay(2000 * (retry + 1));
                }
            }
        }
        
        if (allFailed) {
            console.log('API no disponible. Generando ciudad de demostración...');
            return this.generateMockData();
        }
    }
    
    static generateMockData() {
        const buildings = [];
        const roads = [];
        const nodes = new Map();
        let nodeId = 1;
        
        for (let i = 0; i < 20; i++) {
            for (let j = 0; j < 20; j++) {
                const x = (i - 10) * 80;
                const z = (j - 10) * 80;
                
                const lat = 40.7128 + z / 111000;
                const lon = -74.0060 + x / (111000 * Math.cos(40.7128 * Math.PI / 180));
                
                const cornerNodeId = nodeId++;
                nodes.set(cornerNodeId, { id: cornerNodeId, lat, lon, tags: {} });
                
                const isRoad = i % 4 === 0 || j % 4 === 0;
                
                if (!isRoad && Math.random() > 0.3) {
                    const width = 30 + Math.random() * 40;
                    const depth = 30 + Math.random() * 40;
                    const height = 20 + Math.random() * 80;
                    
                    const buildingNodes = [];
                    const offsets = [
                        [-width/2, -depth/2],
                        [width/2, -depth/2],
                        [width/2, depth/2],
                        [-width/2, depth/2]
                    ];
                    
                    for (const [ox, oz] of offsets) {
                        const nId = nodeId++;
                        const nLat = lat + oz / 111000;
                        const nLon = lon + ox / (111000 * Math.cos(40.7128 * Math.PI / 180));
                        nodes.set(nId, { id: nId, lat: nLat, lon: nLon, tags: {} });
                        buildingNodes.push(nId);
                    }
                    
                    buildings.push({
                        id: 1000 + i * 100 + j,
                        nodes: buildingNodes,
                        tags: {
                            building: ['apartments', 'office', 'house', 'commercial'][Math.floor(Math.random() * 4)],
                            'building:levels': Math.floor(height / 3.5)
                        }
                    });
                }
            }
        }
        
        for (let i = 0; i < 5; i++) {
            const roadNodes = [];
            for (let j = 0; j < 10; j++) {
                const nId = nodeId++;
                const lat = 40.7128 + ((i - 2) * 320) / 111000;
                const lon = -74.0060 + ((j - 5) * 320) / (111000 * Math.cos(40.7128 * Math.PI / 180));
                nodes.set(nId, { id: nId, lat, lon, tags: {} });
                roadNodes.push(nId);
            }
            
            roads.push({
                id: 2000 + i,
                nodes: roadNodes,
                tags: { highway: 'primary' }
            });
        }
        
        for (let j = 0; j < 5; j++) {
            const roadNodes = [];
            for (let i = 0; i < 10; i++) {
                const nId = nodeId++;
                const lat = 40.7128 + ((i - 5) * 320) / 111000;
                const lon = -74.0060 + ((j - 2) * 320) / (111000 * Math.cos(40.7128 * Math.PI / 180));
                nodes.set(nId, { id: nId, lat, lon, tags: {} });
                roadNodes.push(nId);
            }
            
            roads.push({
                id: 3000 + j,
                nodes: roadNodes,
                tags: { highway: 'residential' }
            });
        }
        
        return {
            elements: [
                ...Array.from(nodes.values()),
                ...buildings,
                ...roads
            ]
        };
    }
    
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    static parseOSMData(data) {
        const nodes = new Map();
        const ways = [];
        const relations = [];
        
        for (const element of data.elements) {
            switch (element.type) {
                case 'node':
                    nodes.set(element.id, {
                        id: element.id,
                        lat: element.lat,
                        lon: element.lon,
                        tags: element.tags || {}
                    });
                    break;
                case 'way':
                    if (element.nodes && element.nodes.length >= 3) {
                        ways.push({
                            id: element.id,
                            nodes: element.nodes,
                            tags: element.tags || {}
                        });
                    }
                    break;
                case 'relation':
                    relations.push({
                        id: element.id,
                        members: element.members || [],
                        tags: element.tags || {}
                    });
                    break;
            }
        }
        
        return { nodes, ways, relations };
    }
    
    static isBuildingWay(way) {
        return way.tags && (
            way.tags.building === '*' ||
            way.tags.building === 'yes' ||
            this.isResidentialBuilding(way) ||
            this.isCommercialBuilding(way) ||
            this.isIndustrialBuilding(way)
        );
    }
    
    static isResidentialBuilding(way) {
        const residentialTypes = ['apartments', 'house', 'residential', 'dormitory', 'hotel'];
        return residentialTypes.includes(way.tags.building);
    }
    
    static isCommercialBuilding(way) {
        const commercialTypes = ['office', 'commercial', 'retail', 'shop', 'warehouse'];
        return commercialTypes.includes(way.tags.building);
    }
    
    static isIndustrialBuilding(way) {
        const industrialTypes = ['industrial', 'factory', 'manufacture'];
        return industrialTypes.includes(way.tags.building);
    }
    
    static isRoadWay(way) {
        if (!way.tags) return false;
        
        const roadTypes = [
            'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
            'unclassified', 'residential', 'living_street', 'service'
        ];
        
        if (way.tags.highway && roadTypes.includes(way.tags.highway)) {
            return true;
        }
        
        return way.tags.railway === 'rail' && !way.tags.service;
    }
    
    static getBuildingHeight(way) {
        if (!way.tags) return null;
        
        if (way.tags.height) {
            const match = way.tags.height.match(/^([\d.]+)/);
            if (match) return parseFloat(match[1]);
        }
        
        if (way.tags['building:levels']) {
            const levels = parseInt(way.tags['building:levels']);
            if (!isNaN(levels)) return levels * 3.5;
        }
        
        if (way.tags.building === 'house') return 7 + Math.random() * 3;
        if (way.tags.building === 'apartments') return 20 + Math.random() * 40;
        if (way.tags.building === 'office' || way.tags.building === 'commercial') {
            return 30 + Math.random() * 70;
        }
        
        return 8 + Math.random() * 15;
    }
    
    static getBuildingColor(way) {
        if (!way.tags) return this.getRandomBuildingColor();
        
        const colorMap = {
            'apartments': () => this.lerpColor(0x8899aa, 0xaabbcc, Math.random()),
            'house': () => this.lerpColor(0xccaa88, 0xddbb99, Math.random()),
            'office': () => this.lerpColor(0x6688aa, 0x7799bb, Math.random()),
            'commercial': () => this.lerpColor(0x99aabb, 0xaabbcc, Math.random()),
            'retail': () => this.lerpColor(0xaabbcc, 0xbbccdd, Math.random()),
            'industrial': () => this.lerpColor(0x887766, 0x998877, Math.random()),
            'warehouse': () => this.lerpColor(0x778899, 0x8899aa, Math.random()),
            'hotel': () => this.lerpColor(0xccbbaa, 0xddccbb, Math.random()),
            'school': () => this.lerpColor(0xaabbcc, 0xbbccdd, Math.random()),
            'hospital': () => this.lerpColor(0xbbcccc, 0xccdddd, Math.random()),
            'church': () => this.lerpColor(0x998877, 0xaa9988, Math.random()),
            'roof': () => 0x666666,
        };
        
        const buildingType = way.tags.building;
        if (colorMap[buildingType]) {
            return colorMap[buildingType]();
        }
        
        return this.getRandomBuildingColor();
    }
    
    static getRandomBuildingColor() {
        const palettes = [
            [0x8b9dc3, 0x9fa8da, 0xb0bec5],
            [0xcfd8dc, 0xd7ccc8, 0xe0e0e0],
            [0x90a4ae, 0x78909c, 0x607d8b],
            [0xa1887f, 0x8d6e63, 0x795548],
        ];
        
        const palette = palettes[Math.floor(Math.random() * palettes.length)];
        return palette[Math.floor(Math.random() * palette.length)];
    }
    
    static lerpColor(color1, color2, t) {
        const r1 = (color1 >> 16) & 0xff;
        const g1 = (color1 >> 8) & 0xff;
        const b1 = color1 & 0xff;
        
        const r2 = (color2 >> 16) & 0xff;
        const g2 = (color2 >> 8) & 0xff;
        const b2 = color2 & 0xff;
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        return (r << 16) | (g << 8) | b;
    }
    
    static getRoadColor(way) {
        if (!way.tags) return 0x333333;
        
        const colorMap = {
            'motorway': 0x4466aa,
            'trunk': 0x5588bb,
            'primary': 0x6699cc,
            'secondary': 0x77aaaa,
            'tertiary': 0x88bbbb,
            'residential': 0x222222,
            'unclassified': 0x333333,
            'living_street': 0x444444,
            'service': 0x333333,
            'railway': 0x553333
        };
        
        return colorMap[way.tags.highway] || 0x333333;
    }
    
    static getRoadWidth(way) {
        if (!way.tags) return 6;
        
        const widthMap = {
            'motorway': 16,
            'trunk': 14,
            'primary': 12,
            'secondary': 10,
            'tertiary': 8,
            'residential': 6,
            'unclassified': 6,
            'living_street': 5,
            'service': 4,
            'railway': 4
        };
        
        return widthMap[way.tags.highway] || 6;
    }
}
