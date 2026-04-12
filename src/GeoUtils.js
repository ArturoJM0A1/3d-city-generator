export class GeoUtils {
    static EARTH_RADIUS = 6378137;
    static TILE_SIZE = 1000;
    static SCALE_FACTOR = 1;
    
    static latLonToMercator(lat, lon) {
        const x = this.EARTH_RADIUS * lon * Math.PI / 180;
        const y = this.EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        return { x, y };
    }
    
    static mercatorToLatLon(x, y) {
        const lon = (x / this.EARTH_RADIUS) * 180 / Math.PI;
        const lat = (Math.atan(Math.exp(y / this.EARTH_RADIUS)) - Math.PI / 4) * 360 / Math.PI;
        return { lat, lon };
    }
    
    static latLonToCartesian(lat, lon, centerLat, centerLon) {
        const center = this.latLonToMercator(centerLat, centerLon);
        const point = this.latLonToMercator(lat, lon);
        
        const scale = Math.cos(centerLat * Math.PI / 180);
        
        const x = (point.x - center.x) * scale * this.SCALE_FACTOR;
        const z = (point.y - center.y) * scale * this.SCALE_FACTOR;
        
        return { x, y: 0, z };
    }
    
    static cartesianToLatLon(x, z, centerLat, centerLon) {
        const center = this.latLonToMercator(centerLat, centerLon);
        const scale = Math.cos(centerLat * Math.PI / 180);
        
        const mercX = x / this.SCALE_FACTOR / scale + center.x;
        const mercY = z / this.SCALE_FACTOR / scale + center.y;
        
        return this.mercatorToLatLon(mercX, mercY);
    }
    
    static getTileKey(lat, lon, zoom = 14) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lon + 180) / 360 * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return `${zoom}:${x}:${y}`;
    }
    
    static getTileBounds(tileX, tileY, zoom) {
        const n = Math.pow(2, zoom);
        const lon1 = tileX / n * 360 - 180;
        const lon2 = (tileX + 1) / n * 360 - 180;
        const lat1 = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * 180 / Math.PI;
        const lat2 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tileY + 1) / n))) * 180 / Math.PI;
        
        return {
            minLat: Math.min(lat1, lat2),
            maxLat: Math.max(lat1, lat2),
            minLon: Math.min(lon1, lon2),
            maxLon: Math.max(lon1, lon2)
        };
    }
    
    static metersToScene(meters) {
        return meters * this.SCALE_FACTOR;
    }
    
    static sceneToMeters(units) {
        return units / this.SCALE_FACTOR;
    }
    
    static calculateBounds(nodes) {
        if (!nodes || nodes.length === 0) return null;
        
        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;
        
        for (const node of nodes) {
            if (node.lat !== undefined && node.lon !== undefined) {
                minLat = Math.min(minLat, node.lat);
                maxLat = Math.max(maxLat, node.lat);
                minLon = Math.min(minLon, node.lon);
                maxLon = Math.max(maxLon, node.lon);
            }
        }
        
        return {
            minLat, maxLat,
            minLon, maxLon,
            centerLat: (minLat + maxLat) / 2,
            centerLon: (minLon + maxLon) / 2
        };
    }
    
    static getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
    }
}
