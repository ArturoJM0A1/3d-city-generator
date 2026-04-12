# 🏙️ 3D City Generator - OpenStreetMap + Three.js

![Three.js](https://img.shields.io/badge/Three.js-r160-black?style=flat-square&logo=three.js)
![WebGPU](https://img.shields.io/badge/WebGPU-Supported-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

Generador de ciudades 3D interactivas usando datos reales de **OpenStreetMap** y **Three.js** con soporte para WebGPU.

#Descripción

Este proyecto genera **ciudades 3D interactivas** directamente en el navegador usando Three.js. Imagina Google Earth pero construido automáticamente con código - sin necesidad de模型 3D manuales. El usuario puede explorar ciudades reales como Nueva York, Londres o Tokio, rotando la cámara, haciendo zoom y seleccionado edificios individuales para ver información.

La magia ocurre gracias a **OpenStreetMap**, una base de datos geográfica gratuita que contiene millones de edificios, calles y carreteras mapeadas por voluntarios. El proyecto consulta esta base de datos mediante la Overpass API, descargando información sobre las coordenadas, alturas y tipos de edificios de una zona específica, y luego los convierte en geometría 3D visual.

El código está organizado en módulos especializados: uno maneja las coordenadas geográficas (latitud/longitud a coordenadas 3D), otro conecta con la API de OpenStreetMap, otro genera los edificios con materiales realistas, otro maneja las calles y carreteras, y un sistema de "tiles" que carga y descarga datos según dónde mire la cámara para mantener el rendimiento fluido. Todo esto se renderiza usando WebGPU cuando está disponible (para máximo rendimiento) o WebGL como respaldo.


## 🚀 Características

### Datos Reales

- **Edificios** con alturas reales de OpenStreetMap
- **Calles y carreteras** categorizadas por tipo
- **Ferrocarriles** con durmientes y rails
- **Metadatos** (nombres, niveles, tipos de edificio)

### Renderizado Avanzado

- **WebGPU** como renderer principal (con fallback WebGL2)
- **Post-processing**: Bloom, SMAA anti-aliasing
- **Sombras suaves** PCF
- **Tone mapping** ACES Filmic
- **Niebla atmosférica** exponencial

### Interactividad

- **Controles orbitales** tipo mapa 3D
- **Raycasting** para seleccionar edificios
- **Hover effects** con highlight
- **Fly-to animations** al hacer doble click
- **Búsqueda por ubicación** (geocoding)

### Optimización

- **Carga progresiva** por tiles
- **LOD** (Level of Detail) para grandes ciudades
- **Cache** de datos OSM
- **Merging** de geometrías
- **Frustum culling** automático

## 📁 Estructura del Proyecto

```
3d-city-generator/
├── index.html                 # UI principal con CSS moderno
├── package.json               # Dependencias y scripts
├── vite.config.js             # Configuración de Vite
├── README.md                   # Este archivo
├── SPEC.md                    # Especificaciones técnicas
│
└── src/
    ├── main.js                # Orchestrator principal
    │   ├── Inicializa todos los managers
    │   ├── Maneja eventos de UI
    │   └── Loop de animación
    │
    ├── SceneManager.js        # Configuración de Three.js
    │   ├── Renderer WebGPU/WebGL
    │   ├── Cámara perspectiva
    │   ├── Controles orbitales
    │   ├── Luces (directional, ambient, hemisphere)
    │   ├── Post-processing (bloom, SMAA)
    │   └── Manejo de resize
    │
    ├── GeoUtils.js            # Sistema de coordenadas
    │   ├── latLonToMercator()
    │   ├── mercatorToLatLon()
    │   ├── latLonToCartesian()  # Convierte geo a 3D
    │   ├── getTileKey()
    │   └── calculateBounds()
    │
    ├── OSMService.js          # Conexión a Overpass API
    │   ├── fetchBuildings()
    │   ├── fetchRoads()
    │   ├── fetchAll()
    │   ├── parseOSMData()
    │   ├── getBuildingHeight()
    │   ├── getBuildingColor()
    │   └── Fallback a datos mock
    │
    ├── BuildingGenerator.js   # Generación de edificios
    │   ├── Materiales PBR
    │   ├── ExtrudeGeometry
    │   ├── Simplificación de polígonos
    │   └── Instancing opcional
    │
    ├── RoadGenerator.js       # Generación de calles
    │   ├── CatmullRomCurve3
    │   ├── Geometría de carreteras
    │   ├── Railroads con durmientes
    │   └── Labels como sprites
    │
    ├── TileManager.js         # Sistema de tiles
    │   ├── Carga por proximidad
    │   ├── Descarga de tiles lejanos
    │   ├── Creación de terreno
    │   └── Grid helper
    │
    └── InteractionManager.js  # Interactividad
        ├── Raycasting
        ├── Hover/Selection
        ├── Selection outline
        └── Fly-to animations
```

## 🔧 Instalación

### Requisitos

- **Node.js** 18 o superior
- **npm** o **yarn**

### Pasos

```bash
# 1. Clonar o entrar al directorio
cd 3d-city-generator

# 2. Instalar dependencias
npm install

# 3. Ejecutar en desarrollo
npm run dev

# 4. Abrir en navegador
# http://localhost:5173
```

### Build de producción

```bash
# Compilar
npm run build

# Previsualizar build
npm run preview
```

## 🎮 Controles


| Acción               | Función                   |
| --------------------- | -------------------------- |
| **Click + Arrastrar** | Rotar cámara              |
| **Scroll**            | Zoom in/out                |
| **Shift + Arrastrar** | Mover cámara (pan)        |
| **Click en edificio** | Seleccionar y mostrar info |
| **Doble click**       | Volar hacia el edificio    |
| **Click en preset**   | Cambiar ubicación         |

## 🌍 Ubicaciones Predefinidas


| Ciudad     | Latitud | Longitud |
| ---------- | ------- | -------- |
| Nueva York | 40.7128 | -74.0060 |
| Londres    | 51.5074 | -0.1278  |
| Tokio      | 35.6762 | 139.6503 |
| París     | 48.8566 | 2.3522   |
| CDMX       | 19.4326 | -99.1332 |
| Barcelona  | 41.3851 | 2.1734   |

## 🔌 API de OpenStreetMap

### Overpass API

El proyecto usa la **Overpass API** para obtener datos:

```
https://overpass-api.de/api/interpreter
```

#### Queries utilizadas

**Edificios:**

```
[out:json][timeout:60];
way["building"](around:RADIO,LAT,LON);
out body;
>;
out skel qt;
```

**Carreteras:**

```
[out:json][timeout:60];
way["highway"](around:RADIO,LAT,LON);
out body;
>;
out skel qt;
```

### Manejo de errores

El sistema incluye:

- 4 servidores Overpass de backup
- Retry automático con backoff exponencial
- Cache de 5 minutos
- **Fallback a datos procedurales** si la API falla

## 📊 Rendimiento

### Optimizaciones implementadas


| Técnica                  | Beneficio                       |
| ------------------------- | ------------------------------- |
| **Instancing**            | Reduce draw calls               |
| **Geometry merging**      | Un mesh en lugar de muchos      |
| **Frustum culling**       | No renderiza lo invisible       |
| **LOD**                   | Geometría simple a distancia   |
| **Tile unloading**        | Libera memoria de tiles lejanos |
| **RequestAnimationFrame** | Sync con refresh rate           |

### Targets

- **60 FPS** en hardware moderno
- **30 FPS** mínimo en laptops
- **< 3s** para cargar datos de un tile
- **< 100MB** de uso de memoria para una ciudad de 500 edificios

## 🎨 Personalización

### Modificar colores de edificios

```javascript
// En OSMService.js
static getBuildingColor(way) {
    // Cambiar la paleta de colores
    const palettes = [
        [0x8b9dc3, 0x9fa8da, 0xb0bec5], // Azules
        [0xcfd8dc, 0xd7ccc8, 0xe0e0e0], // Grises claros
        // Agregar más...
    ];
}
```

### Cambiar altura de edificios

```javascript
// En OSMService.js
static getBuildingHeight(way) {
    // Altura base según tipo
    if (way.tags.building === 'house') return 8;
    if (way.tags.building === 'office') return 40;
    // ...
}
```

### Modificar tiles

```javascript
// En TileManager.js
this.tileSize = 800;        // Tamaño de cada tile
this.loadRadius = 2;        // Tiles a cargar alrededor
this.unloadRadius = 3;      // Tiles a descargar
```

## 🔧 Troubleshooting

### "No se encuentran datos"

La Overpass API puede estar sobrecargada. El sistema mostrará una ciudad de demostración.

**Soluciones:**

1. Esperar y reintentar
2. Usar ubicaciones con más densidad de edificios
3. Implementar tu propio servidor Overpass

### Rendimiento bajo

1. Reducir `loadRadius` en `TileManager.js`
2. Reducir `tileSize`
3. Cerrar otras aplicaciones

### Error de CORS

Normalmente no ocurre porque se usa POST directo. Si persiste, verificar:

1. Conexión a internet
2. Firewall
3. Extensiones del navegador

## 🏗️ Arquitectura Técnica

### Sistema de Coordenadas

```
Lat/Lon (WGS84)
    ↓
Mercator Projection (EPSG:3857)
    ↓
Cartesian (X, Y, Z) relativo al centro
```

### Flujo de Datos

```
Búsqueda UI
    ↓
TileManager (calcula tiles visibles)
    ↓
OSMService (fetch a Overpass API)
    ↓
parseOSMData (extrae nodes y ways)
    ↓
BuildingGenerator (crea geometría)
    ↓
THREE.Scene (renderizado)
```

## 📝 Licencia

MIT License - Libre para uso comercial y personal.

## 🤝 Contribuir

1. Fork el repositorio
2. Crear branch (`git checkout -b feature/nueva`)
3. Commit cambios (`git commit -am 'Agregar feature'`)
4. Push al branch (`git push origin feature/nueva`)
5. Crear Pull Request

## 📚 Recursos

- [Three.js Documentation](https://threejs.org/docs/)
- [OpenStreetMap Wiki](https://wiki.openstreetmap.org/)
- [Overpass API Documentation](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)

---

**⭐ Si te resulta útil, dale una estrella al proyecto!**
